import { Router } from 'express';
import validate from '../middlewares/validation';
import milestoneValidation from '../validations/milestoneValidation';
import milestoneController from '../controllers/milestoneController';
import { adminMiddleware } from '../middlewares/adminMiddleware';

const milestoneRoutes = Router();

// Public routes
milestoneRoutes.get('/', milestoneController.getAllMilestones);
milestoneRoutes.get('/my', milestoneController.getMyMilestones);
milestoneRoutes.post('/:id/achieve', milestoneController.achieveMilestone);

// Admin routes
milestoneRoutes.post(
  '/admin/create',
  adminMiddleware,
  validate(milestoneValidation.createMilestone),
  milestoneController.createMilestone
);
milestoneRoutes.put(
  '/admin/:id',
  adminMiddleware,
  validate(milestoneValidation.updateMilestone),
  milestoneController.updateMilestone
);
milestoneRoutes.delete(
  '/admin/:id',
  adminMiddleware,
  milestoneController.deleteMilestone
);

export default milestoneRoutes;
