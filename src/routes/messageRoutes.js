'use strict';

const express = require('express');

const messageController = require('../controller/MessageController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.post(
  '/messages',
  requireAuth,
  (req, res) => messageController.create(req, res)
);

router.get(
  '/messages/me',
  requireAuth,
  (req, res) => messageController.userInbox(req, res)
);

router.get(
  '/messages/me/:messageId',
  requireAuth,
  (req, res) => messageController.userMessageDetail(req, res)
);

router.get(
  '/messages',
  requireAuth, requireAdmin,
  (req, res) => messageController.index(req, res)
);

router.get(
  '/messages/admin',
  requireAuth, requireAdmin,
  (req, res) => messageController.adminInbox(req, res)
);

router.post(
  '/messages/admin/reply',
  requireAuth, requireAdmin,
  (req, res) => messageController.adminReply(req, res)
);

router.get(
  '/messages/user/:userId',
  requireAuth, requireAdmin,
  (req, res) => messageController.userConversation(req, res)
);

router.patch(
  '/messages/:id/read',
  requireAuth, requireAdmin,
  (req, res) => messageController.read(req, res)
);

router.patch(
  '/messages/:id/archive',
  requireAuth, requireAdmin,
  (req, res) => messageController.archive(req, res)
);

router.patch(
  '/messages/:id/unarchive',
  requireAuth, requireAdmin,
  (req, res) => messageController.unarchive(req, res)
);

module.exports = router;
