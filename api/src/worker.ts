import 'dotenv/config'
import { startMessageWorker } from './jobs/messageWorker.js'

startMessageWorker()
