(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.KabinCalculator = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function number(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : (fallback || 0);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, number(value)));
  }

  function creditPayment(principal, annualRate, months) {
    var amount = Math.max(0, number(principal));
    var term = Math.max(1, Math.round(number(months, 1)));
    var monthlyRate = Math.max(0, number(annualRate)) / 1200;
    if (!monthlyRate) return amount / term;
    return amount * monthlyRate / (1 - Math.pow(1 + monthlyRate, -term));
  }

  function leasePayment(principal, annualRate, months, residualPercent) {
    var amount = Math.max(0, number(principal));
    var term = Math.max(1, Math.round(number(months, 1)));
    var monthlyRate = Math.max(0, number(annualRate)) / 1200;
    var residual = clamp(residualPercent, 0, 60) / 100;
    return (amount * (1 - residual) / term) + (amount * monthlyRate);
  }

  function calculateScenario(input) {
    var data = input || {};
    var basePriceMxn = Math.max(0, number(data.basePriceMxn));
    var armorPriceMxn = Math.max(0, number(data.armorPriceMxn));
    var totalPriceMxn = basePriceMxn + armorPriceMxn;
    var downPercent = clamp(data.downPercent, 0, 90);
    var downPaymentMxn = totalPriceMxn * downPercent / 100;
    var amountMxn = Math.max(0, totalPriceMxn - downPaymentMxn);
    var annualRate = clamp(data.annualRate, 0, 100);
    var termMonths = Math.max(1, Math.round(number(data.termMonths, 48)));
    var creditMonthlyPaymentMxn = creditPayment(amountMxn, annualRate, termMonths);
    var leaseMonthlyPaymentMxn = leasePayment(amountMxn, annualRate, termMonths, data.residualPercent);
    var product = data.product === 'lease' ? 'lease' : 'credit';

    return {
      basePriceMxn: basePriceMxn,
      armorPriceMxn: armorPriceMxn,
      totalPriceMxn: totalPriceMxn,
      downPercent: downPercent,
      downPaymentMxn: downPaymentMxn,
      amountMxn: amountMxn,
      annualRate: annualRate,
      termMonths: termMonths,
      creditMonthlyPaymentMxn: creditMonthlyPaymentMxn,
      leaseMonthlyPaymentMxn: leaseMonthlyPaymentMxn,
      monthlyPaymentMxn: product === 'lease' ? leaseMonthlyPaymentMxn : creditMonthlyPaymentMxn,
      product: product
    };
  }

  return {
    creditPayment: creditPayment,
    leasePayment: leasePayment,
    calculateScenario: calculateScenario
  };
});
