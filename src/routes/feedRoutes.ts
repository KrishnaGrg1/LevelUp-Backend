import { Router } from 'express';
import feedController from '../controllers/feedController';

const feedRoutes = Router();

// Dashboard feed
feedRoutes.get('/dashboard', feedController.getDashboard);

export default feedRoutes;
