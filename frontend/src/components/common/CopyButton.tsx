import React, { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { useToast } from '../../context/ToastContext'

interface CopyButtonProps {
  value: string
  label?: string
  size?: number
}

export const CopyButton: React.FC<CopyButtonProps> = ({
  value,
  label = 'Copy to clipboard',
  size = 14,
}) => {
  const [copied, setCopied] = useState(false)
  const { showToast } = useToast()

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(value)
      } else {
        // Fallback for non-secure contexts
        const textArea = document.createElement('textarea')
        textArea.value = value
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }
      setCopied(true)
      showToast('Copied to clipboard', 'success', 2000)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      showToast('Failed to copy to clipboard', 'error', 3000)
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label}
      title={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3px',
        borderRadius: 'var(--radius-xs)',
        color: copied ? 'var(--emerald-500)' : 'var(--text-muted)',
        backgroundColor: 'transparent',
        transition: 'color var(--transition-fast)',
      }}
    >
      {copied ? <Check size={size} strokeWidth={2.5} /> : <Copy size={size} strokeWidth={1.75} />}
    </button>
  )
}
