import { Router } from 'express'
import { ReportsController } from '../controllers/ReportsController'
import { authMiddleware } from '../middlewares/authMiddleware'

const router = Router()
const controller = new ReportsController()

router.use(authMiddleware)
router.get('/summary/monthly', (req, res, next) => controller.monthlySummary(req as any, res, next))
router.get('/summary/category', (req, res, next) => controller.categorySummary(req as any, res, next))
router.get('/summary/category-trend', (req, res, next) => controller.categoryTrend(req as any, res, next))
router.get('/summary/account', (req, res, next) => controller.accountSummary(req as any, res, next))
router.get('/summary/daily', (req, res, next) => controller.dailySummary(req as any, res, next))

export default router
