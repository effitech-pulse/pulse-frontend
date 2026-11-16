import { ArrowLeftOutlined, ArrowRightOutlined } from '@ant-design/icons';
import type { MouseEventHandler, ReactNode } from 'react';
import { Link, type To } from 'react-router-dom';
import './NavigationAction.css';

type NavigationActionProps = {
  children: ReactNode;
  direction?: 'forward' | 'back';
} & (
  | { to: To; onClick?: never; disabled?: never }
  | { to?: never; onClick: MouseEventHandler<HTMLButtonElement>; disabled?: boolean }
);

export function NavigationAction(props: NavigationActionProps) {
  const { children, direction = 'forward' } = props;
  const content = <>
    {direction === 'back' ? <ArrowLeftOutlined aria-hidden="true" /> : null}
    <span className="pulse-navigation-action-label">{children}</span>
    {direction === 'forward' ? <ArrowRightOutlined aria-hidden="true" /> : null}
  </>;

  return props.to !== undefined
    ? <Link className="pulse-navigation-action" to={props.to}>{content}</Link>
    : <button className="pulse-navigation-action" type="button" onClick={props.onClick} disabled={props.disabled}>{content}</button>;
}
