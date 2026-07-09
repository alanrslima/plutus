import { Router } from 'express'
import { authMiddleware } from '../middlewares/authMiddleware'
import { LoansController } from '../controllers/LoansController'

const router = Router()
const controller = new LoansController()

router.get('/', authMiddleware, (req, res, next) => controller.list(req as any, res, next))
router.post('/', authMiddleware, (req, res, next) => controller.create(req as any, res, next))
router.patch('/installments/:installmentId/pay', authMiddleware, (req, res, next) => controller.payInstallment(req as any, res, next))
router.patch('/installments/:installmentId/unpay', authMiddleware, (req, res, next) => controller.unpayInstallment(req as any, res, next))
router.get('/:id', authMiddleware, (req, res, next) => controller.getById(req as any, res, next))
router.put('/:id', authMiddleware, (req, res, next) => controller.update(req as any, res, next))
router.delete('/:id', authMiddleware, (req, res, next) => controller.delete(req as any, res, next))

export default router
