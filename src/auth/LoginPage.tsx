import { useState } from 'react';
import { Alert, Button, Form, Input, Modal } from 'antd';
import type { AuthState } from '@/api/access';
import { useTheme } from '@/theme/ThemeProvider';
import '@/styles/portal-login.css';

export interface LoginValues { login: string; password: string }
interface LoginPageProps {
  mode: AuthState['mode'] | undefined;
  error: string;
  busy: boolean;
  onLogin: (values: LoginValues) => void | Promise<void>;
  onRetry: () => void | Promise<void>;
}

/** Визуальный экран доступа. Сеансом и HTTP-запросами управляет AuthProvider. */
export function LoginPage({ mode, error, busy, onLogin, onRetry }: LoginPageProps) {
  const { dark, toggle } = useTheme();
  const [helpOpen, setHelpOpen] = useState(false);
  return <main className="pulse-login">
    <Button className="pulse-login-theme" aria-label={dark ? 'Светлая тема' : 'Тёмная тема'} onClick={toggle} icon={<img src={`/figma/login/${dark ? 'sun' : 'moon'}.svg`} width={18} height={18} alt="" aria-hidden="true" />} />
    <aside className="pulse-login-product" aria-label="О Pulse">
      <div className="pulse-login-brand"><img src={`/figma/login/pulse-${dark ? 'dark' : 'light'}.svg`} width={48} height={48} alt="" aria-hidden="true" /><span>Пульс скважины</span></div>
      <p className="pulse-login-purpose">Предиктивная диагностика УЭЦН</p>
      <p className="pulse-login-description">Фонд скважин, тревоги и история решений — в одном рабочем пространстве.</p>
      <p className="pulse-login-credit">Разработано<br />ООО «ЭффиТех»</p>
    </aside>
    <section className="pulse-login-access" aria-labelledby="pulse-login-heading" aria-busy={busy}>
      <h1 id="pulse-login-heading">Вход в систему</h1>
      <p className="pulse-login-instruction">{error && mode === 'local' ? 'Проверьте логин и пароль.' : 'Используйте логин и пароль.'}</p>
      {mode === 'local' ? <>
        <Form<LoginValues> className="pulse-login-form" layout="vertical" onFinish={onLogin} requiredMark={false}>
          <Form.Item name="login" label="Логин" rules={[{ required: true, message: 'Введите логин' }]}><Input autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={80} /></Form.Item>
          <Form.Item name="password" label="Пароль" rules={[{ required: true, message: 'Введите пароль' }]}><Input.Password autoComplete="current-password" /></Form.Item>
          {error ? <Alert className="pulse-login-error" type="error" message={error} role="alert" /> : null}
          <div className="pulse-login-actions"><Button type="primary" htmlType="submit" loading={busy}>Войти</Button><Button onClick={() => setHelpOpen(true)}>Забыли пароль?</Button></div>
        </Form>
        <div className="pulse-login-divider" />
        <p className="pulse-login-access-hint">Нет учётной записи? Обратитесь к администратору организации.</p>
        <Button className="pulse-login-request" onClick={() => setHelpOpen(true)}>Запросить доступ</Button>
      </> : <>
        {error ? <Alert className="pulse-login-error" type="error" message={error} role="alert" /> : null}
        <Button className="pulse-login-retry" onClick={() => void onRetry()}>Повторить подключение</Button>
      </>}
    </section>
    <Modal className="pulse-login-help" title="Доступ к Pulse" open={helpOpen} onCancel={() => setHelpOpen(false)} footer={<Button type="primary" onClick={() => setHelpOpen(false)}>Понятно</Button>} width={520} centered>
      <p>Обратитесь к администратору организации.</p>
      <p>Администратор создаёт учётную запись и меняет пароль. Права доступа сохраняются в Pulse.</p>
    </Modal>
  </main>;
}
