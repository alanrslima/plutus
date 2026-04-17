import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'

import authRoutes from './interfaces/routes/auth.routes'
import accountsRoutes from './interfaces/routes/accounts.routes'
import categoriesRoutes from './interfaces/routes/categories.routes'
import transactionsRoutes from './interfaces/routes/transactions.routes'
import reportsRoutes from './interfaces/routes/reports.routes'
import importRoutes from './interfaces/routes/import.routes'
import copilotRoutes from './interfaces/routes/copilot.routes'
import goalsRoutes from './interfaces/routes/goals.routes'
import { errorHandler } from './interfaces/middlewares/errorHandler'

const app = express()

app.use(helmet())
app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

app.use('/auth', authRoutes)
app.use('/accounts', accountsRoutes)
app.use('/categories', categoriesRoutes)
app.use('/transactions', transactionsRoutes)
app.use('/reports', reportsRoutes)
app.use('/import', importRoutes)
app.use('/copilot', copilotRoutes)
app.use('/goals', goalsRoutes)

app.use(errorHandler)

const PORT = process.env.PORT ?? 3333
app.listen(PORT, () => {
  console.log(`🚀 Plutos API running on http://localhost:${PORT}`)
})

export default app
