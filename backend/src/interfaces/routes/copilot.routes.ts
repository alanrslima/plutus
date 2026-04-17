import { Router } from 'express'
import { authMiddleware } from '../middlewares/authMiddleware'
import { CopilotController } from '../controllers/CopilotController'

const router = Router()
const controller = new CopilotController()

router.get('/insights', authMiddleware, (req, res, next) => controller.getInsights(req as any, res, next))
router.post('/analyze', authMiddleware, (req, res, next) => controller.analyze(req as any, res, next))
router.post('/action', authMiddleware, (req, res, next) => controller.executeAction(req as any, res, next))
router.patch('/insights/:id/dismiss', authMiddleware, (req, res, next) => controller.dismiss(req as any, res, next))

export default router
