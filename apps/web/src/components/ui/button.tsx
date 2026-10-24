import type { ButtonHTMLAttributes } from 'react';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'outline' | 'quiet';
  size?: 'default' | 'compact';
};
export function Button({ variant = 'primary', size = 'default', className = '', type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={`ui-button ui-button--${variant} ui-button--${size} ${className}`} {...props} />;
}
