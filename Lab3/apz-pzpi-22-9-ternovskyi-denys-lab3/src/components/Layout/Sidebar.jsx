import React from 'react'
import { NavLink } from 'react-router-dom'
import { 
  LayoutDashboard, 
  CheckSquare, 
  Smartphone, 
  BarChart3, 
  Users, 
  Shield,
  FileText,
  Settings
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useLanguage } from '../../contexts/LanguageContext'

const Sidebar = () => {
  const { user } = useAuth()
  const { t } = useLanguage()

  const navigationItems = [
    {
      name: t('dashboard'),
      href: '/dashboard',
      icon: LayoutDashboard,
      current: false,
    },
    {
      name: t('tasks'),
      href: '/tasks',
      icon: CheckSquare,
      current: false,
    },
    {
      name: t('devices'),
      href: '/devices',
      icon: Smartphone,
      current: false,
    },
    {
      name: t('analytics'),
      href: '/analytics',
      icon: BarChart3,
      current: false,
    },
  ]

  const adminItems = [
    {
      name: t('admin'),
      href: '/admin',
      icon: Shield,
      current: false,
    },
    {
      name: t('users'),
      href: '/admin/users',
      icon: Users,
      current: false,
    },
    {
      name: t('deviceManagement'),
      href: '/admin/devices',
      icon: Smartphone,
      current: false,
    },
    {
      name: t('systemLogs'),
      href: '/admin/logs',
      icon: FileText,
      current: false,
    },
  ]

  const NavItem = ({ item }) => (
    <NavLink
      to={item.href}
      className={({ isActive }) =>
        `group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
          isActive
            ? 'bg-blue-100 text-blue-700 border-r-2 border-blue-700'
            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
        }`
      }
    >
      <item.icon
        className="mr-3 h-5 w-5 flex-shrink-0"
        aria-hidden="true"
      />
      {item.name}
    </NavLink>
  )

  return (
    <div className="fixed inset-y-0 left-0 z-40 w-64 bg-white shadow-sm border-r border-gray-200 pt-16">
      <div className="flex flex-col h-full">
        {/* Main Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          <div className="space-y-1">
            {navigationItems.map((item) => (
              <NavItem key={item.name} item={item} />
            ))}
          </div>

          {/* Admin Section */}
          {user?.role === 'admin' && (
            <div className="pt-6">
              <div className="px-3 py-2">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {t('admin')}
                </h3>
              </div>
              <div className="space-y-1">
                {adminItems.map((item) => (
                  <NavItem key={item.name} item={item} />
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* User Info Footer */}
        <div className="flex-shrink-0 border-t border-gray-200 p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-white">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </span>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-700">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-gray-500 capitalize">
                {user?.role}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Sidebar