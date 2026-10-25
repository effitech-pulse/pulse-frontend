/** Reveal closed ancestors outside-in before focusing the current field. */
export function revealAccessField(target: HTMLElement | null): void {
    if (!target) return;
    const ancestors: HTMLDetailsElement[] = [];
    for (let parent = target.parentElement; parent; parent = parent.parentElement) {
        if (parent.tagName === 'DETAILS' && !(parent as HTMLDetailsElement).open) ancestors.push(parent as HTMLDetailsElement);
    }
    for (const details of ancestors.reverse()) details.open = true;
    target.focus();
    target.scrollIntoView({ block: 'center' });
}
