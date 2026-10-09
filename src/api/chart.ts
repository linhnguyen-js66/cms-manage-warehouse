import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
dayjs.extend(isoWeek);

export const buildWeeklyFraudData = (data: any[]) => {
  const weekMap: Record<string, number> = {};

  data.forEach((item) => {
    if (item.status?.fraud_prediction !== 1) return;

    const week = dayjs(item.transactionTime).isoWeek();
    weekMap[week] = (weekMap[week] || 0) + 1;
  });

  return Object.entries(weekMap).map(([week, count]) => ({
    week: Number(week),
    fraudCount: count,
  }));
};

export const buildDailyFraudData = (data: any[]) => {
  const result: { day: string; hour: number; fraudCount: number }[] = [];
  const map: Record<string, Record<number, number>> = {};

  data.forEach((item) => {
    if (item.status?.fraud_prediction !== 1) return;

    const day = dayjs(item.transactionTime).format("YYYY-MM-DD");
    const hour = Number(item.hour);

    if (!map[day]) map[day] = {};
    map[day][hour] = (map[day][hour] || 0) + 1;
  });

  // Convert map → array cho AntD Charts
  Object.entries(map).forEach(([day, hours]) => {
    Object.entries(hours).forEach(([hour, count]) => {
      result.push({
        day,
        hour: Number(hour),
        fraudCount: count,
      });
    });
  });

  return result;
};

export const buildCountryPieData = (data: any[]) => {
  const countryMap: Record<string, number> = {};

  data.forEach((item) => {
    const country = item?.merchantCountry;
    countryMap[country] = (countryMap[country] || 0) + 1;
  });

  return Object.entries(countryMap).map(([country, count]) => ({
    type: country,
    value: count,
  }));
};

export const calcFraudRate = (data: any[]) => {
  const total = data.length;
  const fraudCount = data.filter(
    (item) => item.status?.fraud_prediction == 1
  ).length;
  return { total, fraudCount };
};
