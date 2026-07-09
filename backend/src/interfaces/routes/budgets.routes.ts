import { Router } from 'express'
import { authMiddleware } from '../middlewares/authMiddleware'
import { BudgetsController } from '../controllers/BudgetsController'

const router = Router()
const controller = new BudgetsController()

router.get('/', authMiddleware, (req, res, next) => controller.list(req as any, res, next))
router.post('/', authMiddleware, (req, res, next) => controller.create(req as any, res, next))
router.put('/:id', authMiddleware, (req, res, next) => controller.update(req as any, res, next))
router.delete('/:id', authMiddleware, (req, res, next) => controller.delete(req as any, res, next))

export default router
