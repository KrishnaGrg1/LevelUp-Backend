import client from '../helpers/prisma';
import { AuthRequest } from '../middlewares/authMiddleware';
import { Request, Response } from 'express';
import { Language } from '../translation/translation';
import {
  makeErrorResponse,
  makeSuccessResponse,
} from '../helpers/standardResponse';
import {
  initializeKhaltiPayment,
  verifyKhaltiPayment,
} from '../lib/khaltiConfig';

const initializeKhalti = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const lang = req.language as Language;
    const userId = req.user?.id; // Assuming your authMiddleware sets req.user
    const { itemId, totalPrice, websiteUrl } = req.body;

    // CRITICAL: Check authentication
    if (!userId) {
      res
        .status(401)
        .json(
          makeErrorResponse(
            new Error(`User not authenticated`),
            'error.auth.not_authenticated',
            lang,
            401
          )
        );
      return;
    }

    const subscriptionData = await client.subscriptionPlan.findFirst({
      where: {
        id: itemId,
        price: Number(totalPrice),
      },
    });

    if (!subscriptionData) {
      res
        .status(401)
        .json(
          makeErrorResponse(
            new Error(`Item not found`),
            'error.auth.not_authenticated',
            lang,
            401
          )
        );
      return;
    }

    // creating a purchase document to store purchase info
    const purchasedItemData = await client.purchasedPlan.create({
      data: {
        userId: userId,
        planId: itemId,
        paymentMethod: 'khalti',
        totalPrice: totalPrice,
      },
    });

    const paymentInitate = await initializeKhaltiPayment({
      amount: totalPrice * 100, // amount should be in paisa (Rs * 100)
      purchaseOrderId: purchasedItemData.id, // purchase_order_id because we need to verify it later
      purchaseOrderName: subscriptionData.planName,
      returnUrl: `${process.env.BACKEND_URI}/api/v1/payment/complete-khalti-payment`, // it can be even managed from frontedn
      websiteUrl: websiteUrl,
    });

    res.json({
      success: true,
      purchasedItemData,
      payment: paymentInitate,
    });
    return;
  } catch (error: any) {
    console.error('Khalti error:', error?.response?.data || error.message);
    throw error?.response?.data || error;
  }
};

const completeKhaltiPayment = async (req: Request, res: Response) => {
  try {
    const { pidx, purchase_order_id, transaction_id } = req.query;

    if (!pidx || !purchase_order_id) {
      return res.status(400).json({ message: 'Missing parameters' });
    }

    const paymentInfo = await verifyKhaltiPayment(pidx as string);

    if (paymentInfo.status !== 'Completed') {
      return res.redirect(`${process.env.FRONTEND_URI}/payment-failed`);
    }

    const purchasedItem = await client.purchasedPlan.findUnique({
      where: { id: purchase_order_id as string },
      include: {
        plan: true, //  related SubscriptionPlan
      },
    });

    if (!purchasedItem) {
      return res.status(404).json({ message: 'Purchase not found' });
    }

    if (purchasedItem.totalPrice * 100 !== paymentInfo.total_amount) {
      return res.status(400).json({ message: 'Amount mismatch' });
    }

    // Use transaction to ensure all operations succeed or fail together
    await client.$transaction(async (tx) => {
      // 1. Update purchased plan status
      await tx.purchasedPlan.update({
        where: { id: purchase_order_id as string },
        data: { status: 'completed' },
      });

      // 2. Create payment record
      await tx.payment.create({
        data: {
          pidx: pidx as string,
          transactionId: transaction_id as string,
          productId: purchase_order_id as string,
          amount: paymentInfo.total_amount / 100,
          dataFromVerificationReq: paymentInfo,
          paymentGateway: 'khalti',
          status: 'success',
        },
      });

      // 3. Activate subscription
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + purchasedItem.plan.durationMonth);

      await tx.subscription.upsert({
        where: { userId: purchasedItem.userId },
        update: {
          planId: purchasedItem.planId,
          startDate,
          endDate,
          status: 'active',
          purchaseId: purchasedItem.id,
        },
        create: {
          userId: purchasedItem.userId,
          planId: purchasedItem.planId,
          startDate,
          endDate,
          status: 'active',
          purchaseId: purchasedItem.id,
        },
      });
    });

    // Redirect to success page with query parameters
    return res.redirect(
      `${process.env.FRONTEND_URI}/eng/payment/success?pidx=${pidx}&purchase_order_id=${purchase_order_id}&transaction_id=${transaction_id}`
    );
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Payment verification failed' });
  }
};

const paymentController = {
  initializeKhalti,
  completeKhaltiPayment,
};

export default paymentController;
