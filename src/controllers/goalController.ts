// import { Response } from 'express';
// import IRequest from '../middlewares/authMiddleware';
// import client from '../helpers/prisma';
// import findUser from '../helpers/findUser';
// import { GoalCategory } from '../helpers/goal';
// import { makeErrorResponse } from '../helpers/standartResponse';
// import { Language } from '../translation/translation';
// import { TranslationRequest } from '../middlewares/translationMiddleware';

// const submitGoal = async (
//   req: TranslationRequest,
//   res: Response
// ): Promise<void> => {
//   try {
//     const userID = Number(req.userID);

//     const existingUser = await findUser(Number(userID));
//     if (!existingUser) {
//       res
//         .status(400)
//         .json(
//           makeErrorResponse(
//             new Error('User doesnot exist'),
//             'error.auth.user_not_found',
//             req.language as Language,
//             400
//           )
//         );
//       return;
//     }
//     const existingGoal = await client.goal.findFirst({
//       where: {
//         userId: userID,
//       },
//       select: {
//         id: true,
//       },
//     });

//     console.log('existingGoal:', existingGoal);
//     if (existingGoal) {
//       res.status(400).json({
//         message: 'User has already goal',
//       });
//       return;
//     }
//     const { title, category, selfRating } = req.body;
//     console.log('category type:', typeof category);
//     console.log('category value:', category);

//     // Check that category matches the enum exactly
//     if (!Object.values(GoalCategory).includes(category)) {
//       res.status(400).json({ message: 'Invalid category value' });
//       return;
//     }

//     const newGoal = await client.goal.create({
//       data: {
//         userId: userID,
//         title,
//         category: category as GoalCategory, // now valid
//         selfRating,
//       },
//     });

//     res.status(200).json({
//       newGoal,
//       message: 'created goal',
//     });
//   } catch (e: unknown) {
//     if (e instanceof Error) {
//       res.status(500).json({
//         message: e.message,
//       });
//     } else {
//       res.status(500).json({
//         messsage: 'Unexpected Error has occurred',
//       });
//     }
//   }
// };

// const goalControllers = {
//   submitGoal,
// };

// export default goalControllers;
