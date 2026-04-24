import { AnimatePresence, motion } from 'framer-motion'
import { useSession, type ScreenId } from '@/state/session-store'
import { useTheme } from '@/state/theme-store'
import { BootScreen } from '@/screens/BootScreen'
import { ThemeSelectScreen } from '@/screens/ThemeSelectScreen'
import { HomeScreen } from '@/screens/HomeScreen'
import { PaymentScreen } from '@/screens/PaymentScreen'
import { TemplateScreen } from '@/screens/TemplateScreen'
import { FilterScreen } from '@/screens/FilterScreen'
import { CaptureScreen } from '@/screens/CaptureScreen'
import { PreviewScreen } from '@/screens/PreviewScreen'

export default function App() {
  const screen = useSession((s) => s.screen)
  const theme = useTheme((s) => s.theme)

  // Boot and theme-select render outside the theme frame so they can own their
  // own full-surface visuals (TV boot animation, dark picker background).
  const usesFrame = screen !== 'boot' && screen !== 'theme-select'
  const Frame = theme.FrameComponent

  return (
    <div className="kiosk-frame">
      <div className="kiosk-stage">
        {usesFrame ? (
          <Frame>
            <ScreenSwitcher screen={screen} />
          </Frame>
        ) : (
          <ScreenSwitcher screen={screen} />
        )}
      </div>
    </div>
  )
}

function ScreenSwitcher({ screen }: { screen: ScreenId }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={screen}
        initial={{ opacity: 0, filter: 'brightness(2) blur(4px)' }}
        animate={{ opacity: 1, filter: 'brightness(1) blur(0px)' }}
        exit={{ opacity: 0, filter: 'brightness(1.5) blur(3px)' }}
        transition={{ duration: 0.25 }}
        className="absolute inset-0"
      >
        {renderScreen(screen)}
      </motion.div>
    </AnimatePresence>
  )
}

function renderScreen(s: ScreenId) {
  switch (s) {
    case 'boot': return <BootScreen />
    case 'theme-select': return <ThemeSelectScreen />
    case 'home': return <HomeScreen />
    case 'payment': return <PaymentScreen />
    case 'template': return <TemplateScreen />
    case 'filter': return <FilterScreen />
    case 'capture': return <CaptureScreen />
    case 'preview': return <PreviewScreen />
  }
}
