/** Tecla física (keycap) com o atalho. */
export function Keycap({ children, label }: { children: React.ReactNode; label?: string }): JSX.Element {
  return (
    <kbd className="keycap" aria-label={label}>
      {children}
    </kbd>
  )
}
