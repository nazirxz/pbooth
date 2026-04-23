import { motion } from 'framer-motion'
import { ChannelBar } from '@/components/ChannelBar'
import { TVButton } from '@/components/TVButton'
import { useSession } from '@/state/session-store'
import { appConfig } from '@/config/app-config'

export function HomeScreen() {
  const goTo = useSession((s) => s.goTo)

  const start = () => goTo(appConfig.payment.enabled ? 'payment' : 'template')

  return (
    <div className="absolute inset-0 flex flex-col">
      <ChannelBar channel="01" label="WELCOME" />

      <div className="flex-1 flex flex-col items-center justify-center px-10 gap-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <div className="font-pixel text-6xl text-crt-phosphor rgb-split leading-[1.2]">
            PHOTO
            <br />
            BOOTH
          </div>
          <div className="mt-8 font-crt text-3xl text-crt-cream/85 tracking-widest">
            TAP TO START YOUR SESSION
          </div>
        </motion.div>

        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, type: 'spring' }}
        >
          <TVButton onClick={start} size="xl" variant="primary">
            ▶ PRESS START
          </TVButton>
        </motion.div>

        <div className="font-crt text-xl text-crt-amber/80 tracking-wider text-center">
          {appConfig.payment.enabled
            ? `RP ${appConfig.payment.amount.toLocaleString('id-ID')} / SESSION`
            : 'FREE MODE'}
        </div>
      </div>

      <div className="px-10 pb-8 flex justify-between font-crt text-lg text-crt-cream/50 tracking-wider">
        <span>CH 01 / WELCOME</span>
        <span>STEREO</span>
      </div>
    </div>
  )
}
