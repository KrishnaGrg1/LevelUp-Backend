import { Router } from 'express';
import client from '../helpers/prisma';
import paymentController from '../controllers/paymentController';
import paymentValidation from '../validations/paymentValidation';
import validate from '../middlewares/validation';
import { authMiddleware } from '../middlewares/authMiddleware';

const paymentRoutes = Router();

paymentRoutes.get('/add', authMiddleware, async (req, res) => {
  const subscriptionPlans = await client.subscriptionPlan.findMany({});
  res.render('purchase', {
    subscriptionPlans,
    message: '',
  });
});

// route to initilize khalti payment gateway
paymentRoutes.post(
  '/initialize-khalti',
  authMiddleware,

  paymentController.initializeKhalti
);

// it is our `return url` where we verify the payment done by user
paymentRoutes.get(
  '/complete-khalti-payment',

  paymentController.completeKhaltiPayment
);

//need to add subsscription plan

// paymentRoutes.post(
//   '/add',
//   validate(paymentValidation.addpayment),
//   paymentController.initiatePayment
// );

// paymentRoutes.get('/verify', paymentController.completepayment);

export default paymentRoutes;
