import client from '../helpers/prisma';
import { AuthRequest } from '../middlewares/authMiddleware';
import { Response } from 'express';
import { Language } from '../translation/translation';
import {
  makeErrorResponse,
  makeSuccessResponse,
} from '../helpers/standardResponse';

const addsubscriptionPlan = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const lang = req.language as Language;

    const { planName, durationMonth, price, features } = req.body;

    const existingsubscriptionPlan = await client.subscriptionPlan.findFirst({
      where: {
        planName: planName,
      },
    });

    // If any exist, return error
    if (existingsubscriptionPlan) {
      res
        .status(400)
        .json(
          makeErrorResponse(
            new Error(`subscriptionPlan already taken or used`),
            'error.subscriptionPlan.subscriptionPlan_exists',
            lang,
            400
          )
        );
      return;
    }

    const newSubscriptionPlan = await client.subscriptionPlan.create({
      data: {
        planName,
        durationMonth,
        price,
        features: features || [], //  an array
      },
    });

    res
      .status(200)
      .json(
        makeSuccessResponse(
          { subscriptionPlan: newSubscriptionPlan },
          'success.subscriptionPlan.added_subscriptionPlan',
          lang,
          200
        )
      );
    return;
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    console.error('Error adding subscriptionPlans:', e);
    res
      .status(500)
      .json(
        makeErrorResponse(
          e instanceof Error ? e : new Error('Add subscriptionPlan failed'),
          'error.subscriptionPlan.failed_to_add_subscriptionPlan',
          lang,
          500
        )
      );
  }
};

//get subscription plans
const getsubscriptionPlans = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const lang = req.language as Language;

    const subscriptionPlans = await client.subscriptionPlan.findMany();

    // If doesnot exist, return error
    if (subscriptionPlans.length === 0) {
      res
        .status(400)
        .json(
          makeErrorResponse(
            new Error(`No subscription plans found`),
            'error.subscriptionPlan.subscriptionPlan_not_found',
            lang,
            400
          )
        );
      return;
    }

    res
      .status(200)
      .json(
        makeSuccessResponse(
          { subscriptionPlans },
          'success.subscriptionPlan.fetched_subscriptionPlans',
          lang,
          200
        )
      );
    return;
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    console.error('Error fetching subscriptionPlans:', e);
    res
      .status(500)
      .json(
        makeErrorResponse(
          e instanceof Error ? e : new Error('Fetch subscriptionPlans failed'),
          'error.subscriptionPlan.failed_to_fetch_subscriptionPlans',
          lang,
          500
        )
      );
  }
};

const subscriptionController = {
  addsubscriptionPlan,
  getsubscriptionPlans,
};

export default subscriptionController;
