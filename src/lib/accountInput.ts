import type { Account, AccountInput, AccessScope } from '../api/access';

export type AccountDraft = Omit<AccountInput, 'scope'> & {
  scope?: Partial<AccessScope>;
  ngduMode: 'all' | 'selected';
  departmentMode: 'all' | 'selected';
};

/** Сохраняет серверную область доступа независимо от полей формы. */
export function accountInputFromDraft(
  draft: AccountDraft,
  existing?: Pick<Account, 'scope'> | null,
): AccountInput {
  return {
    login: draft.login,
    name: draft.name,
    role: draft.role,
    active: draft.active,
    revision: draft.revision,
    scope: {
      // Исторический discriminator хранится только на границе HTTP/RBAC.
      funds: existing ? [...existing.scope.funds] : ['presentation'],
      ngdus: draft.ngduMode === 'all' ? null : (draft.scope?.ngdus ?? []),
      departments: draft.departmentMode === 'all' ? null : (draft.scope?.departments ?? []),
    },
    ...(draft.password ? { password: draft.password } : {}),
  };
}
