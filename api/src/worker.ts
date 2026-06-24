import 'dotenv/config'
import { startMessageWorker } from './jobs/messageWorker.js'
import { startBillingWarningWorker } from './jobs/billingWarningWorker.js'

startMessageWorker()
startBillingWarningWorker()
