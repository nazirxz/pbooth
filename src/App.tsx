import { AnimatePresence, motion } from 'framer-motion'
import { CRTFrame } from '@/components/CRTFrame'
import { useSession } from '@/state/session-store'
import { BootScreen } from '@/screens/BootScreen'
import { HomeScreen } from '@/screens/HomeScreen'
import { PaymentScreen } from '@/screens/PaymentScreen'
import { TemplateScreen } from '@/screens/TemplateScreen'
import { FilterScreen } from '@/screens/FilterScreen'
import { CaptureScreen } from '@/screens/CaptureScreen'
import { PreviewScreen } from '@/screens/PreviewScreen'

export default function App() {
  const screen = useSession((s) => s.screen)

  return (
    <div className="kiosk-frame">
      <div className="kiosk-stage">
        <CRTFrame>
          <AnimatePresence mode="wait">
            <motion.div
              key={screen}
              initial={{ opacity: 0, filter: 'brightness(3) blur(6px)' }}
              animate={{ opacity: 1, filter: 'brightness(1) blur(0px)' }}
              exit={{ opacity: 0, filter: 'brightness(2) blur(4px)' }}
              transition={{ duration: 0.25 }}
              className="absolute inset-0"
            >
              {renderScreen(screen)}
            </motion.div>
          </AnimatePresence>
        </CRTFrame>
      </div>
    </div>
  )
}

function renderScreen(s: ReturnType<typeof useSession.getState>['screen']) {
  switch (s) {
    case 'boot': return <BootScreen />
    case 'home': return <HomeScreen />
    case 'payment': return <PaymentScreen />
    case 'template': return <TemplateScreen />
    case 'filter': return <FilterScreen />
    case 'capture': return <CaptureScreen />
    case 'preview': return <PreviewScreen />
  }
}
