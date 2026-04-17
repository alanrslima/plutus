import { Router } from 'express'
import { authMiddleware } from '../middlewares/authMiddleware'
import { GoalsController } from '../controllers/GoalsController'

const router = Router()
const controller = new GoalsController()

router.get('/', authMiddleware, (req, res, next) => controller.list(req as any, res, next))
router.post('/', authMiddleware, (req, res, next) => controller.create(req as any, res, next))
router.patch('/:id/status', authMiddleware, (req, res, next) => controller.updateStatus(req as any, res, next))
router.delete('/:id', authMiddleware, (req, res, next) => controller.delete(req as any, res, next))

export default router
