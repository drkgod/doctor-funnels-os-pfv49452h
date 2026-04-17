import { Suspense, useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom'
import { format } from 'date-fns'
import { useTheme } from '@/hooks/use-theme'
import { useAuthContext } from '@/hooks/use-auth'
import { SidebarNav } from './SidebarNav'
import { LoadingScreen } from './LoadingScreen'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetHeader,
  SheetClose,
} from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Menu,
  Moon,
  Sun,
  Settings,
  LogOut,
  Bell,
  Calendar,
  FileText,
  Mic,
  Info,
  AlertTriangle,
  WifiOff,
  X,
  Home,
  Users,
  MoreHorizontal,
  Mail,
  Zap,
  BarChart2,
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useNotifications } from '@/hooks/use-notifications'
import { Skeleton } from '@/components/ui/skeleton'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { useInstallPrompt } from '@/hooks/use-install-prompt'
import { useToast } from '@/hooks/use-toast'
import { ToastAction } from '@/components/ui/toast'

function getRelativeTime(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000)

  if (diffInMinutes < 1) return 'agora'
  if (diffInMinutes < 60) return `ha ${diffInMinutes} min`

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `ha ${diffInHours} ${diffInHours === 1 ? 'hora' : 'horas'}`

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays === 1) return 'ontem'
  if (diffInDays < 7) return `ha ${diffInDays} dias`

  return format(date, 'dd/MM')
}

export default function AppLayout() {
  const { theme, setTheme } = useTheme()
  const { profile, signOut } = useAuthContext()
  const navigate = useNavigate()
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useNotifications()
  const location = useLocation()
  const isOnline = useOnlineStatus()
  const { canInstall, showInstallPrompt, setCanInstall } = useInstallPrompt()
  const { toast } = useToast()

  const [wasOffline, setWasOffline] = useState(false)
  const [showInstallBanner, setShowInstallBanner] = useState(false)

  useEffect(() => {
    if (!isOnline) setWasOffline(true)
    if (isOnline && wasOffline) {
      setTimeout(() => setWasOffline(false), 3000)
    }
  }, [isOnline, wasOffline])

  useEffect(() => {
    const handleSWUpdate = () => {
      toast({
        title: 'Nova versão disponível',
        description: 'Recarregue a página para aplicar.',
        action: (
          <ToastAction altText="Recarregar" onClick={() => window.location.reload()}>
            Recarregar
          </ToastAction>
        ),
      })
    }
    window.addEventListener('sw-update-found', handleSWUpdate)
    return () => window.removeEventListener('sw-update-found', handleSWUpdate)
  }, [toast])

  useEffect(() => {
    const dismissedAt = localStorage.getItem('df-install-dismissed')
    if (dismissedAt) {
      const days = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24)
      if (days > 7) {
        localStorage.removeItem('df-install-dismissed')
        setShowInstallBanner(canInstall)
      } else {
        setShowInstallBanner(false)
      }
    } else {
      setShowInstallBanner(canInstall)
    }
  }, [canInstall])

  const dismissInstallBanner = () => {
    localStorage.setItem('df-install-dismissed', Date.now().toString())
    setShowInstallBanner(false)
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const getInitials = (name?: string) => {
    if (!name) return 'DF'
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'super_admin':
        return 'Administrador'
      case 'doctor':
        return 'Medico'
      case 'secretary':
        return 'Secretaria'
      default:
        return 'Usuario'
    }
  }

  const navItems = [
    { icon: Home, label: 'Dashboard', path: '/dashboard' },
    { icon: Calendar, label: 'Agenda', path: '/agenda' },
    { icon: FileText, label: 'Prontuários', path: '/prontuarios' },
    { icon: Users, label: 'CRM', path: '/crm' },
  ]

  const moreItems = [
    { icon: Mail, label: 'Email Marketing', path: '/email' },
    { icon: Zap, label: 'Automações', path: '/automations' },
    { icon: BarChart2, label: 'Relatórios', path: '/reports' },
    { icon: Settings, label: 'Configurações', path: '/settings' },
  ]

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-[hsl(45,93%,47%)] text-[hsl(45,93%,15%)] px-4 py-2 flex items-center justify-center gap-2 text-[12px] font-medium animate-in slide-in-from-top">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Você está sem conexão. Algumas funções podem não funcionar.</span>
        </div>
      )}
      {isOnline && wasOffline && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-green-500 text-white px-4 py-2 flex items-center justify-center gap-2 text-[12px] font-medium animate-in slide-in-from-top">
          <span>Conexão restabelecida</span>
        </div>
      )}

      {/* Header */}
      <header
        className={`fixed ${!isOnline || wasOffline ? 'top-[36px]' : 'top-0'} left-0 right-0 z-50 h-16 border-b bg-card flex items-center px-4 justify-between lg:px-6 shadow-sm transition-all duration-300`}
      >
        <div className="flex items-center gap-4">
          <div className="flex flex-col leading-none select-none">
            <span className="text-primary font-bold text-[20px] tracking-tight">
              Doctor Funnels
            </span>
            <span className="text-accent font-medium text-[11px] tracking-[2px] mt-0.5">OS</span>
          </div>
        </div>

        <div className="flex items-center gap-3 md:gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="active:scale-95 transition-transform"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            <span className="sr-only">Toggle theme</span>
          </Button>

          <Popover open={notificationsOpen} onOpenChange={setNotificationsOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative active:scale-95 transition-transform"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                    {unreadCount >= 10 ? '9+' : unreadCount}
                  </span>
                )}
                <span className="sr-only">Toggle notifications</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-[calc(100vw-32px)] md:w-[380px] p-0 overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
            >
              <div className="flex items-center justify-between border-b px-4 py-3.5">
                <span className="text-[14px] font-semibold">Notificacoes</span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-[11px] text-primary hover:underline font-medium"
                  >
                    Marcar todas como lidas
                  </button>
                )}
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {isLoading ? (
                  <div className="p-4 space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex gap-3">
                        <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="p-10 text-center flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-muted/30 flex items-center justify-center mb-3">
                      <Bell className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                    <span className="text-[13px] text-muted-foreground">Nenhuma notificacao</span>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {notifications.map((notif) => {
                      let Icon = Info
                      let bgClass = 'bg-secondary'
                      let iconColorClass = 'text-muted-foreground'

                      if (notif.type === 'appointment') {
                        Icon = Calendar
                        bgClass = 'bg-[hsl(270,60%,50%)]/10'
                        iconColorClass = 'text-[hsl(270,60%,50%)]'
                      } else if (notif.type === 'record') {
                        Icon = FileText
                        bgClass = 'bg-primary/10'
                        iconColorClass = 'text-primary'
                      } else if (notif.type === 'transcription') {
                        Icon = Mic
                        bgClass = 'bg-[hsl(195,80%,45%)]/10'
                        iconColorClass = 'text-[hsl(195,80%,45%)]'
                      } else if (notif.type === 'alert') {
                        Icon = AlertTriangle
                        bgClass = 'bg-destructive/10'
                        iconColorClass = 'text-destructive'
                      }

                      return (
                        <div
                          key={notif.id}
                          className={`flex gap-2.5 p-3 px-4 border-b border-border/30 cursor-pointer transition-colors hover:bg-secondary/30 relative ${!notif.read ? 'bg-primary/5' : ''}`}
                          onClick={() => {
                            markAsRead(notif.id)
                            setNotificationsOpen(false)
                            if (notif.reference_type === 'medical_record' && notif.reference_id) {
                              navigate(`/prontuarios/${notif.reference_id}`)
                            } else if (notif.reference_type === 'appointment') {
                              navigate('/agenda')
                            }
                          }}
                        >
                          {!notif.read && (
                            <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary" />
                          )}
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${bgClass} ${!notif.read ? 'ml-2' : ''}`}
                          >
                            <Icon className={`w-3.5 h-3.5 ${iconColorClass}`} />
                          </div>
                          <div className="flex flex-col flex-1">
                            <span className="text-[13px] font-medium leading-tight text-foreground">
                              {notif.title}
                            </span>
                            <span className="text-[12px] text-muted-foreground leading-[1.4] mt-0.5">
                              {notif.message}
                            </span>
                            <span className="text-[10px] text-muted-foreground mt-1">
                              {getRelativeTime(notif.created_at)}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              <div className="border-t border-border/50 p-2.5 flex justify-center bg-card">
                <button className="text-[12px] font-medium text-primary hover:underline">
                  Ver todas
                </button>
              </div>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-9 w-9 rounded-full active:scale-95 transition-transform"
              >
                <Avatar className="h-9 w-9 border border-border">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                    {getInitials(profile?.full_name)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {profile?.full_name || 'Usuário'}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {getRoleLabel(profile?.role)}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer" onClick={() => navigate('/settings')}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Configuracoes</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer text-destructive focus:text-destructive"
                onClick={handleSignOut}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main Layout Area */}
      <div className={`flex flex-1 ${!isOnline || wasOffline ? 'pt-[100px]' : 'pt-16'}`}>
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex fixed left-0 top-16 bottom-0 w-[260px] border-r bg-card flex-col z-40">
          <SidebarNav />
        </aside>

        {/* Content Area */}
        <main className="flex-1 lg:ml-[260px] w-full pb-[80px] lg:pb-0">
          <div className="max-w-[1280px] mx-auto p-4 md:p-6 min-h-[calc(100vh-4rem)]">
            <Suspense fallback={<LoadingScreen />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>

      {/* Install Banner (Mobile) */}
      {showInstallBanner && (
        <div className="fixed bottom-[72px] left-4 right-4 z-50 bg-card border border-border rounded-xl p-4 shadow-lg flex items-center justify-between lg:hidden animate-in slide-in-from-bottom">
          <span className="text-[13px] font-medium">Instale o app para acesso rápido</span>
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={showInstallPrompt} className="h-8 px-3 text-[12px]">
              Instalar
            </Button>
            <button onClick={dismissInstallBanner} className="text-muted-foreground p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-[64px] bg-card border-t border-border flex items-center justify-around z-50 pb-[env(safe-area-inset-bottom)]">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path)
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center gap-[2px] w-full h-full py-2 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
        })}
        <Sheet>
          <SheetTrigger asChild>
            <button className="flex flex-col items-center justify-center gap-[2px] w-full h-full py-2 text-muted-foreground">
              <MoreHorizontal className="w-5 h-5" />
              <span className="text-[10px] font-medium">Mais</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[auto] max-h-[85vh] p-0 rounded-t-xl">
            <SheetHeader className="p-4 border-b text-left">
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <div className="py-2">
              {moreItems.map((item) => (
                <SheetClose asChild key={item.path}>
                  <Link
                    to={item.path}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/50"
                  >
                    <item.icon className="w-5 h-5 text-muted-foreground" />
                    <span className="text-[14px] font-medium">{item.label}</span>
                  </Link>
                </SheetClose>
              ))}
              <div className="my-2 border-t border-border" />
              <SheetClose asChild>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 text-destructive"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="text-[14px] font-medium">Sair</span>
                </button>
              </SheetClose>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </div>
  )
}
