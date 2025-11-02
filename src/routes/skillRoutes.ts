import { Router } from 'express';
import validate from '../middlewares/validation';
import skillValidation from '../validations/skillValidation';
import skillController from '../controllers/skillController';
import { adminMiddleware } from '../middlewares/adminMiddleware';

const skillRoutes = Router();

// Public routes
skillRoutes.get('/', skillController.getAllSkills);
skillRoutes.get('/:id', skillController.getSkillById);

// User routes
skillRoutes.post(
  '/enroll',
  validate(skillValidation.enrollSkill),
  skillController.enrollInSkill
);
skillRoutes.post(
  '/select',
  validate(skillValidation.selectSkills),
  skillController.selectSkills
);
skillRoutes.get('/my/enrolled', skillController.getMySkills);
skillRoutes.get('/my/:id', skillController.getUserSkillById);

// Admin routes
skillRoutes.post(
  '/admin/create',
  adminMiddleware,
  validate(skillValidation.createSkill),
  skillController.createSkill
);
skillRoutes.put(
  '/admin/:id',
  adminMiddleware,
  validate(skillValidation.updateSkill),
  skillController.updateSkill
);
skillRoutes.delete(
  '/admin/:id',
  adminMiddleware,
  skillController.deleteSkill
);

export default skillRoutes;
