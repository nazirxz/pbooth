import { AnimatePresence, motion } from 'framer-motion'
import { CRTFrame } from '@/components/CRTFrame'
import { SessionTimer } from '@/components/SessionTimer'
import { useSession, type ScreenId } from '@/state/session-store'
import { BootScreen } from '@/screens/BootScreen'
import { HomeScreen } from '@/screens/HomeScreen'
import { PaymentScreen } from '@/screens/PaymentScreen'
import { InstructionsScreen } from '@/screens/InstructionsScreen'
import { TemplateScreen } from '@/screens/TemplateScreen'
import { FilterScreen } from '@/screens/FilterScreen'
import { CaptureScreen } from '@/screens/CaptureScreen'
import { DecorateScreen } from '@/screens/DecorateScreen'
import { PreviewScreen } from '@/screens/PreviewScreen'
import { SettingsScreen } from '@/screens/SettingsScreen'

export default function App() {
  const screen = useSession((s) => s.screen)
  const usesFrame = screen !== 'boot'

  return (
    <div className="kiosk-frame">
      <div className="kiosk-stage">
        {usesFrame ? (
          <CRTFrame>
            <ScreenSwitcher screen={screen} />
            <SessionTimer />
          </CRTFrame>
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
    case 'home': return <HomeScreen />
    case 'settings': return <SettingsScreen />
    case 'payment': return <PaymentScreen />
    case 'instructions': return <InstructionsScreen />
    case 'template': return <TemplateScreen />
    case 'filter': return <FilterScreen />
    case 'capture': return <CaptureScreen />
    case 'decorate': return <DecorateScreen />
    case 'preview': return <PreviewScreen />
  }
}
