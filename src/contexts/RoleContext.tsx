import { createContext, useEffect, useState } from 'react'

export type Role = 'super_admin' | 'doctor' | 'secretary'

type RoleProviderProps = {
  children: React.ReactNode
  defaultRole?: Role
  storageKey?: string
}

type RoleProviderState = {
  role: Role
  setRole: (role: Role) => void
}

const initialState: RoleProviderState = {
  role: 'super_admin',
  setRole: () => null,
}

export const RoleContext = createContext<RoleProviderState>(initialState)

export function RoleProvider({
  children,
  defaultRole = 'super_admin',
  storageKey = 'df-role',
  ...props
}: RoleProviderProps) {
  const [role, setRole] = useState<Role>(
    () => (localStorage.getItem(storageKey) as Role) || defaultRole,
  )

  const value = {
    role,
    setRole: (newRole: Role) => {
      localStorage.setItem(storageKey, newRole)
      setRole(newRole)
    },
  }

  return (
    <RoleContext.Provider {...props} value={value}>
      {children}
    </RoleContext.Provider>
  )
}
