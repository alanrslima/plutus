import { Router } from 'express'
import { authMiddleware } from '../middlewares/authMiddleware'
import { ImportController } from '../controllers/ImportController'

const router = Router()
const controller = new ImportController()

router.post('/preview', authMiddleware, controller.upload.single('file'), (req, res, next) =>
  controller.parsePreview(req as any, res, next),
)
router.post('/confirm', authMiddleware, (req, res, next) =>
  controller.confirmImport(req as any, res, next),
)
router.get('/history', authMiddleware, (req, res, next) =>
  controller.getHistory(req as any, res, next),
)

export default router
