import React from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: React.ReactNode
  isLoading?: boolean
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'secondary',
  size = 'md',
  icon,
  isLoading = false,
  disabled,
  style,
  ...props
}) => {
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: 'var(--emerald-500)',
          color: 'var(--text-inverse)',
          fontWeight: 600,
          border: '1px solid var(--emerald-600)',
        }
      case 'danger':
        return {
          backgroundColor: 'var(--crimson-bg)',
          color: 'var(--crimson-500)',
          fontWeight: 600,
          border: '1px solid var(--crimson-border)',
        }
      case 'outline':
        return {
          backgroundColor: 'transparent',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-emphasis)',
        }
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          color: 'var(--text-secondary)',
          border: '1px solid transparent',
        }
      case 'secondary':
      default:
        return {
          backgroundColor: 'var(--surface-elevated)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-default)',
        }
    }
  }

  const getSizeStyles = (): React.CSSProperties => {
    switch (size) {
      case 'sm':
        return {
          padding: '4px 8px',
          fontSize: '12px',
          height: '28px',
        }
      case 'lg':
        return {
          padding: '8px 16px',
          fontSize: '14px',
          height: '38px',
        }
      case 'md':
      default:
        return {
          padding: '6px 12px',
          fontSize: '13px',
          height: '32px',
        }
    }
  }

  return (
    <button
      disabled={disabled || isLoading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        borderRadius: 'var(--radius-sm)',
        cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
        opacity: disabled || isLoading ? 0.5 : 1,
        transition: 'all var(--transition-fast)',
        userSelect: 'none',
        ...getVariantStyles(),
        ...getSizeStyles(),
        ...style,
      }}
      {...props}
    >
      {isLoading ? (
        <span
          style={{
            display: 'inline-block',
            width: '12px',
            height: '12px',
            border: '2px solid currentColor',
            borderRightColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.6s linear infinite',
          }}
        />
      ) : (
        icon && <span style={{ display: 'inline-flex', alignItems: 'center' }}>{icon}</span>
      )}
      {children}
    </button>
  )
}
