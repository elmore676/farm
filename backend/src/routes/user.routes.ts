import { Router } from 'express';
import { requireAuth, roleGuard } from '../middleware/auth';
import { listUsers, getUser, createUser, updateUser, deleteUser } from '../controllers/user.controller';

const router = Router();

router.use(requireAuth);
router.get('/', roleGuard(['admin']), listUsers);
router.post('/', roleGuard(['admin']), createUser);
router.get('/:id', roleGuard(['admin', 'manager']), getUser);
router.put('/:id', roleGuard(['admin']), updateUser);
router.delete('/:id', roleGuard(['admin']), deleteUser);

export default router;
