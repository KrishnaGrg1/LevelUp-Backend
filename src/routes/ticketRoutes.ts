import { Router } from 'express';
import validate from '../middlewares/validation';
import ticketValidation from '../validations/ticketValidation';
import ticketController from '../controllers/ticketController';

const ticketRoutes = Router();

ticketRoutes.post(
  '/create',
  validate(ticketValidation.createTicket),
  ticketController.createTicket
);
ticketRoutes.get('', ticketController.getAllTicketsByUser);
ticketRoutes.get('/:id', ticketController.getTicketById);
ticketRoutes.put(
  '/:id',
  validate(ticketValidation.updateTicket),
  ticketController.updateTicketById
);
ticketRoutes.delete('/:id', ticketController.deleteTicketById);
export default ticketRoutes;
