// src/utils/formatters.ts
import format from 'date-fns/format';
import parseISO from 'date-fns/parseISO';
import differenceInDays from 'date-fns/differenceInDays';
import differenceInHours from 'date-fns/differenceInHours';
import isToday from 'date-fns/isToday';
import isYesterday from 'date-fns/isYesterday';
import fr from 'date-fns/locale/fr';

function formatNumberFR(n: number, decimals: number = 0): string {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const intPart = Math.floor(abs);
  const fracPart = decimals > 0
    ? Math.round((abs - intPart) * Math.pow(10, decimals)).toString().padStart(decimals, '0')
    : '';
  const parts = intPart.toString().split('');
  let result = '';
  for (let i = parts.length - 1, j = 0; i >= 0; i--, j++) {
    if (j > 0 && j % 3 === 0) result = '\u00A0' + result;
    result = parts[i] + result;
  }
  return sign + result + (fracPart ? ',' + fracPart : '');
}

export class Formatters {
  // Formater une date
  static formatDate(date: string | Date, formatStr: string = 'dd/MM/yyyy'): string {
    try {
      const dateObj = typeof date === 'string' ? parseISO(date) : date;
      return format(dateObj, formatStr, { locale: fr });
    } catch {
      return 'Date invalide';
    }
  }

  // Formater une date avec heure
  static formatDateTime(date: string | Date): string {
    return this.formatDate(date, 'dd/MM/yyyy HH:mm');
  }

  // Formater un nombre à la française (séparateur de milliers)
  static formatNumber(amount: number, decimals: number = 0): string {
    return formatNumberFR(amount, decimals);
  }

  // Formater un montant en devise
  static formatCurrency(amount: number, currency: string = 'FCFA'): string {
    return `${formatNumberFR(amount)} ${currency}`;
  }

  // Formater un numéro de téléphone
  static formatPhone(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.length === 10) {
      return cleaned.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
    }
    
    return phone;
  }

  // Formater un temps relatif
  static formatRelativeTime(date: string | Date): string {
    try {
      const dateObj = typeof date === 'string' ? parseISO(date) : date;
      
      if (isToday(dateObj)) {
        return `Aujourd'hui à ${format(dateObj, 'HH:mm')}`;
      }
      
      if (isYesterday(dateObj)) {
        return `Hier à ${format(dateObj, 'HH:mm')}`;
      }
      
      const daysDiff = differenceInDays(new Date(), dateObj);
      
      if (daysDiff < 7) {
        return `Il y a ${daysDiff} jour${daysDiff > 1 ? 's' : ''}`;
      }
      
      if (daysDiff < 30) {
        const weeks = Math.floor(daysDiff / 7);
        return `Il y a ${weeks} semaine${weeks > 1 ? 's' : ''}`;
      }
      
      return this.formatDate(dateObj, 'dd MMM yyyy');
    } catch {
      return 'Date invalide';
    }
  }

  // Raccourcir un texte
  static truncateText(text: string, maxLength: number = 50): string {
    if (text.length <= maxLength) return text;
    return `${text.substring(0, maxLength)}...`;
  }

  // Formater un statut
  static formatStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'A_LIVRER': 'À livrer',
      'LIVREE': 'Terminée',
      'ANNULEE': 'Annulée'
    };
    
    return statusMap[status] || status;
  }

  // Formater un pourcentage
  static formatPercentage(value: number, decimals: number = 0): string {
    return `${value.toFixed(decimals)}%`;
  }

  // Calculer la progression
  static calculateProgress(current: number, target: number): number {
    if (target === 0) return 0;
    const progress = (current / target) * 100;
    return Math.min(Math.max(progress, 0), 100);
  }
}