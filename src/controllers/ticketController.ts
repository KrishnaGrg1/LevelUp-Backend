import { Response } from 'express';
import {
  makeErrorResponse,
  makeSuccessResponse,
} from '../helpers/standardResponse';
import { AuthRequest } from '../middlewares/authMiddleware';
import { Language } from '../translation/translation';
import client from '../helpers/prisma';
import logger from '../helpers/logger';

const createTicket = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const lang = (req.language as Language) || 'eng';
    const { subject, message, priority } = req.body;
    const userId = req.user?.id;
    const newTicket = await client.ticket.create({
      data: {
        userId: userId as string,
        subject,
        message,
        priority,
        updatedAt: new Date(),
      },
    });
    
    res.status(201).json(
      makeSuccessResponse(
        {
          ticket: newTicket,
        },
        'success.ticket.create',
        lang,
        200
      )
    );
    return;
  } catch (e: unknown) {
    logger.error('Prisma create ticket error', e, { userId: req.user?.id });
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to create ticket'),
          'error.ticket.failed_to_create',
          lang,
          500
        )
      );
  }
  return;
};

const getAllTicketsByUser = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const lang = (req.language as Language) || 'eng';
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const skip = (page - 1) * pageSize;
    const userId = req.user?.id;
    const user = await client.user.findUnique({
      where: {
        id: userId as string,
      },
    });
    if (user?.isAdmin === true) {
      const [tickets, total] = await Promise.all([
        client.ticket.findMany({
          orderBy: {
            createdAt: 'desc',
          },
          skip,
          take: pageSize,
        }),
        client.ticket.count(),
      ]);
      res.status(200).json(
        makeSuccessResponse(
          {
            tickets,
            pagination: {
              total,
              page,
              pageSize,
              totalPages: Math.ceil(total / pageSize),
            },
          },
          'success.ticket.fetch_all',
          lang,
          200
        )
      );
      return;
    }
    const [tickets, total] = await Promise.all([
      client.ticket.findMany({
        where: {
          userId: userId as string,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: pageSize,
      }),
      client.ticket.count({
        where: {
          userId: userId as string,
        },
      }),
    ]);
    res.status(200).json(
      makeSuccessResponse(
        {
          tickets,
          pagination: {
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
          },
        },
        'success.ticket.fetch_all',
        lang,
        200
      )
    );
    return;
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to create ticket'),
          'error.ticket.failed_to_create',
          lang,
          500
        )
      );
  }
  return;
};

const getTicketById = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const lang = (req.language as Language) || 'eng';
    const ticketId = req.params.id;
    const userId = req.user?.id;
    const user = await client.user.findUnique({
      where: {
        id: userId as string,
      },
    });
    const ticket = await client.ticket.findFirst({
      where: {
        id: ticketId as string,
      },
    });
    if (!ticket) {
      res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('Ticket not found'),
            'error.ticket.not_found',
            lang,
            404
          )
        );
      return;
    }
    if (ticket.userId !== userId && user?.isAdmin !== true) {
      res
        .status(403)
        .json(
          makeErrorResponse(
            new Error('Forbidden access to ticket'),
            'error.ticket.forbidden',
            lang,
            403
          )
        );
      return;
    }
    res
      .status(200)
      .json(makeSuccessResponse(ticket, 'success.ticket.fetch', lang, 200));
    return;
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to get ticket'),
          'error.ticket.failed_to_get_ticket',
          lang,
          500
        )
      );
  }
  return;
};
const deleteTicketById = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const lang = (req.language as Language) || 'eng';
    const ticketId = req.params.id;
    const userId = req.user?.id;
    const ticket = await client.ticket.findFirst({
      where: {
        id: ticketId as string,
      },
    });
    if (!ticket) {
      res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('Ticket not found'),
            'error.ticket.not_found',
            lang,
            404
          )
        );
      return;
    }
    if (ticket.userId !== userId) {
      res
        .status(403)
        .json(
          makeErrorResponse(
            new Error('Forbidden access to ticket'),
            'error.ticket.forbidden',
            lang,
            403
          )
        );
      return;
    }
    await client.ticket.delete({
      where: {
        id: ticketId as string,
      },
    });
    res
      .status(200)
      .json(makeSuccessResponse(null, 'success.ticket.delete', lang, 200));
    return;
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to get ticket'),
          'error.ticket.failed_to_get_ticket',
          lang,
          500
        )
      );
  }
  return;
};
const updateTicketById = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const lang = (req.language as Language) || 'eng';
    const ticketId = req.params.id;
    const { subject, message, priority } = req.body;
    const userId = req.user?.id;
    const ticket = await client.ticket.findFirst({
      where: {
        id: ticketId as string,
      },
    });
    if (!ticket) {
      res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('Ticket not found'),
            'error.ticket.not_found',
            lang,
            404
          )
        );
      return;
    }
    if (ticket.userId !== userId) {
      res
        .status(403)
        .json(
          makeErrorResponse(
            new Error('Forbidden access to ticket'),
            'error.ticket.forbidden',
            lang,
            403
          )
        );
      return;
    }
    const updatedTicket = await client.ticket.update({
      where: {
        id: ticketId as string,
      },
      data: {
        subject,
        message,
        priority,
      },
    });
    res
      .status(200)
      .json(
        makeSuccessResponse(updatedTicket, 'success.ticket.update', lang, 200)
      );
    return;
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to create ticket'),
          'error.ticket.failed_to_create',
          lang,
          500
        )
      );
  }
  return;
};
const ticketController = {
  createTicket,
  getAllTicketsByUser,
  getTicketById,
  updateTicketById,
  deleteTicketById,
};

export default ticketController;
