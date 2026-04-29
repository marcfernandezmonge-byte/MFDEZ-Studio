'use strict';

const authService = require('./AuthService');
const userRepository = require('../repository/UserRepository');
const serviceRepository = require('../repository/ServiceRepository');

class UserServices {
  async getServices(authHeader) {
    const user = await this._getUserFromAuthHeader(authHeader);
    const services = await serviceRepository.getServicesForUser(user);
    return { services };
  }

  async getMembership(authHeader) {
    const user = await this._getUserFromAuthHeader(authHeader);
    const membership = await userRepository.getMembershipByUserId(user.id);
    return { membership };
  }

  async getAdminUsers(authHeader) {
    await this._requireAdmin(authHeader);

    const users = await userRepository.findAll();
    return {
      users: users.map((user) => ({
        id: user.id,
        name: user.name || user.username || 'Usuario',
        email: user.email,
        role: user.role || 'user',
        createdAt: user.createdAt,
        active: true,
      })),
    };
  }

  async getAdminClubMembers(authHeader) {
    await this._requireAdmin(authHeader);

    const users = await userRepository.findAll();
    const members = users.map((user) => {
      const membership = this._buildMembership(user);
      return {
        id: user.id,
        name: user.name || user.username || 'Usuario',
        email: user.email,
        plan: membership.plan,
        since: membership.since,
        renewal: membership.renewal,
        active: membership.active,
      };
    });

    const activeMembers = members.filter((member) => member.active).length;
    return {
      members,
      revenueMonth: activeMembers * 15,
    };
  }

  async toggleClubMemberStatus(authHeader, memberId, active) {
    await this._requireAdmin(authHeader);

    const updatedUser = await userRepository.setMembershipStatus(memberId, active);
    if (!updatedUser) {
      throw new Error('Usuario no encontrado');
    }

    return {
      member: {
        id: updatedUser.id,
        name: updatedUser.name || updatedUser.username || 'Usuario',
        active: Boolean(updatedUser.isSubscribed),
      },
    };
  }

  async subscribeUser(userId, options = {}) {
    const user = await userRepository.findById(userId);
    if (!user) throw new Error('Usuario no encontrado');
    if (user.isSubscribed) throw new Error('Ya tienes una suscripción activa');
    const updated = await userRepository.subscribeUser(userId, options);
    return { subscription: this._buildMembership(updated) };
  }

  async getUserSubscription(userId) {
    const membership = await userRepository.getMembershipByUserId(userId);
    return { subscription: membership };
  }

  async cancelSubscription(userId) {
    const user = await userRepository.findById(userId);
    if (!user) throw new Error('Usuario no encontrado');
    if (!user.isSubscribed) throw new Error('No tienes una suscripción activa');
    await userRepository.cancelSubscription(userId);
    return { message: 'Suscripción cancelada correctamente' };
  }

  async deleteUser(userId) {
    const deleted = await userRepository.deleteUser(userId);
    if (!deleted) throw new Error('No se pudo eliminar la cuenta');
    return { message: 'Cuenta eliminada correctamente' };
  }

  async _getUserFromAuthHeader(authHeader) {
    if (!authHeader) throw new Error('No autenticado');

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    if (!token) throw new Error('Token vacío');

    const payload = await authService.verifyToken(token);
    const userId = payload.id || payload.sub;
    const user = await userRepository.findById(userId);

    if (!user) throw new Error('Usuario no encontrado');
    return user;
  }

  async _requireAdmin(authHeader) {
    const user = await this._getUserFromAuthHeader(authHeader);
    if (user.role !== 'admin') {
      throw new Error('Acceso denegado: se requiere rol admin');
    }
    return user;
  }

  _buildMembership(user) {
    const billingInfo = user.billingInfo || {};
    const active = Boolean(user.isSubscribed);
    const since = billingInfo.since || user.createdAt || new Date().toISOString();
    const renewal = billingInfo.renewal || this._addOneYear(since);

    return {
      active,
      tier: "Collector's Club",
      since,
      renewal,
      plan: billingInfo.plan || "Collector's Club · 15€/mes",
      status: active ? 'active' : 'inactive',
      benefits: ['Acceso anticipado', 'Descuentos VIP'],
    };
  }

  _addOneYear(dateString) {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    date.setFullYear(date.getFullYear() + 1);
    return date.toISOString();
  }
}

module.exports = new UserServices();