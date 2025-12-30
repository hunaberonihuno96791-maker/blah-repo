import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  type JSX,
} from "react";

// Типы для данных таймлайна (совпадают с Pydantic схемой)
interface TimelineItem {
  id: number;
  group: string;
  name: string;
  startDate: string; // Формат 'YYYY-MM-DD'
  endDate: string | null; // Формат 'YYYY-MM-DD' или null, если продолжается
}

// Типы для состояния свернутых групп
interface CollapsedGroups {
  [key: string]: boolean;
}

const MONTH_WIDTH_PX = 90; // Ширина одного месяца в пикселях
const ROW_HEIGHT_PX = 54; // Увеличиваем высоту строки для еще лучшего UX
const MONTH_NAMES_SHORT = [
  "янв",
  "фев",
  "мар",
  "апр",
  "май",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
];

// Адрес вашего FastAPI бэкенда
// Используем переменную окружения VITE_API_URL или значение по умолчанию
// В dev окружении - http://localhost:8000
// В prod окружении - http://localhost:8001 (настраивается в docker-compose.yml)
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Вспомогательная функция для форматирования даты
const formatDate = (dateString: string | null): string => {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return ""; // Проверяем валидность даты
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${day}.${month}.${year}`;
};

// Вспомогательная функция для подсчета дней между датами
const getDaysBetween = (date1Str: string, date2Str: string | null): number => {
  const d1 = new Date(date1Str);
  const d2 = date2Str ? new Date(date2Str) : new Date(); // Если endDate null, используем текущую дату
  // Обнуляем время, чтобы считать только полные дни
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0; // Проверяем валидность дат
  // Добавляем 1 день, чтобы учесть начальный и конечный день включительно
  return (
    Math.round(Math.abs(d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) +
    1
  );
};

// Вспомогательная функция для получения читаемого периода времени
const getReadableDuration = (days: number): string => {
  if (days < 30) return `${days} дн.`;
  if (days < 365) {
    const months = Math.floor(days / 30);
    const remainingDays = days % 30;
    return remainingDays > 0 ? `${months} мес. ${remainingDays} дн.` : `${months} мес.`;
  }
  const years = Math.floor(days / 365);
  const remainingMonths = Math.floor((days % 365) / 30);
  return remainingMonths > 0 ? `${years} г. ${remainingMonths} мес.` : `${years} г.`;
};

// Интерфейс для схемы цветов группы
// interface GroupColorScheme {
//   bg: string;
//   from: string;
//   to: string;
//   hover: string;
// }

// Предопределенные цвета для групп
// const GROUP_COLORS: Record<string, GroupColorScheme> = {
//   "профессии": {
//     bg: "#3498db",
//     from: "#3498db",
//     to: "#2980b9",
//     hover: "#1a5276"
//   },
//   "путешествия": {
//     bg: "#e67e22",
//     from: "#e67e22",
//     to: "#d35400",
//     hover: "#a04000"
//   },
//   "проекты": {
//     bg: "#9b59b6",
//     from: "#9b59b6",
//     to: "#8e44ad",
//     hover: "#6c3483"
//   },
//   "образование": {
//     bg: "#27ae60",
//     from: "#27ae60",
//     to: "#229954",
//     hover: "#196f3d"
//   },
//   "личное": {
//     bg: "#e74c3c",
//     from: "#e74c3c",
//     to: "#c0392b",
//     hover: "#922b21"
//   }
// };

// Массив дополнительных цветов для новых групп
// const ADDITIONAL_COLORS: GroupColorScheme[] = [
//   { bg: "#16a085", from: "#16a085", to: "#1abc9c", hover: "#0e6655" }, // бирюзовый
//   { bg: "#f1c40f", from: "#f1c40f", to: "#f39c12", hover: "#b7950b" }, // желтый
//   { bg: "#7f8c8d", from: "#7f8c8d", to: "#95a5a6", hover: "#616a6b" }, // серый
//   { bg: "#2c3e50", from: "#2c3e50", to: "#34495e", hover: "#1b2631" }, // темно-синий
//   { bg: "#d35400", from: "#d35400", to: "#e67e22", hover: "#a04000" }, // оранжевый
//   { bg: "#8e44ad", from: "#8e44ad", to: "#9b59b6", hover: "#6c3483" }, // фиолетовый
//   { bg: "#2ecc71", from: "#2ecc71", to: "#27ae60", hover: "#196f3d" }, // зеленый
//   { bg: "#e84393", from: "#e84393", to: "#fd79a8", hover: "#c2185b" }, // розовый
//   { bg: "#6c5ce7", from: "#6c5ce7", to: "#a29bfe", hover: "#4834d4" }, // лавандовый
//   { bg: "#00cec9", from: "#00cec9", to: "#81ecec", hover: "#008b8b" }  // голубой
// ];

// Функция для получения цветов для группы
// const getGroupColors = (groupName: string): GroupColorScheme => {
//   const normalizedGroupName = groupName.toLowerCase().replace(/\s+/g, "-");
//   
//   // Проверяем, есть ли предопределенные цвета для этой группы
//   if (GROUP_COLORS[normalizedGroupName]) {
//     return GROUP_COLORS[normalizedGroupName];
//   }
//   
//   // Если нет, генерируем псевдослучайный индекс на основе имени группы
//   let hash = 0;
//   for (let i = 0; i < normalizedGroupName.length; i++) {
//     hash = normalizedGroupName.charCodeAt(i) + ((hash << 5) - hash);
//   }
//   
//   // Используем этот хеш для выбора цвета из дополнительного массива
//   const colorIndex = Math.abs(hash) % ADDITIONAL_COLORS.length;
//   return ADDITIONAL_COLORS[colorIndex];
// };

// Главный компонент приложения
const TimelineApp: React.FC = () => {
  // Состояние для данных таймлайна
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]); // Изначально пустой массив

  // Состояние для полей формы добавления
  const [itemName, setItemName] = useState<string>("");
  const [itemGroup, setItemGroup] = useState<string>("Профессии");
  const [itemStartDate, setItemStartDate] = useState<string>("");
  const [itemEndDate, setItemEndDate] = useState<string>(""); // Пустая строка означает 'н.в.'

  // Состояние для отслеживания свернутых групп
  const [collapsedGroups, setCollapsedGroups] = useState<CollapsedGroups>({});

  // Рефы для DOM-элементов для прямого доступа (нужно для логики перетаскивания)
  const timelineMainRef = useRef<HTMLDivElement>(null);
  const todayLineRef = useRef<HTMLDivElement>(null);

  // Состояние для логики перетаскивания (скролла)
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartX = useRef<number>(0);
  const dragScrollLeft = useRef<number>(0);

  // **** НОВЫЙ useEffect для загрузки данных при монтировании компонента ****
  useEffect(() => {
    const fetchItems = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/timeline`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const responseData = await response.json();
        // Convert snake_case from API to camelCase for our frontend
        const data: TimelineItem[] = responseData.map((item: any) => ({
          id: item.id,
          group: item.group,
          name: item.name,
          startDate: item.start_date,
          endDate: item.end_date
        }));
        setTimelineItems(data);
      } catch (error) {
        console.error("Failed to fetch timeline items:", error);
        // Можно показать сообщение об ошибке пользователю
      }
    };
    fetchItems();
  }, []); // Пустой массив зависимостей означает, что эффект запустится один раз при монтировании

  // Обработчики событий для перетаскивания (скролла)
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>): void => {
      if (e.button === 0 && timelineMainRef.current) {
        setIsDragging(true);
        dragStartX.current = e.pageX - timelineMainRef.current.offsetLeft;
        dragScrollLeft.current = timelineMainRef.current.scrollLeft;
        e.preventDefault();
      }
    },
    []
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>): void => {
      if (!isDragging || !timelineMainRef.current) return;
      e.preventDefault();
      const x = e.pageX - timelineMainRef.current.offsetLeft;
      const walk = (x - dragStartX.current) * 1.5; // Увеличиваем скорость прокрутки
      timelineMainRef.current.scrollLeft = dragScrollLeft.current - walk;
    },
    [isDragging]
  );

  const handleMouseUp = useCallback((): void => {
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback((): void => {
    setIsDragging(false);
  }, []);

  // Применяем/удаляем слушатели событий для перетаскивания
  useEffect(() => {
    const timelineMainElement = timelineMainRef.current;
    if (timelineMainElement) {
      timelineMainElement.addEventListener(
        "mousedown",
        handleMouseDown as unknown as EventListener
      );
      timelineMainElement.addEventListener(
        "mousemove",
        handleMouseMove as unknown as EventListener
      );
      timelineMainElement.addEventListener(
        "mouseup",
        handleMouseUp as EventListener
      );
      timelineMainElement.addEventListener(
        "mouseleave",
        handleMouseLeave as EventListener
      );
    }
    return () => {
      if (timelineMainElement) {
        timelineMainElement.removeEventListener(
          "mousedown",
          handleMouseDown as unknown as EventListener
        );
        timelineMainElement.removeEventListener(
          "mousemove",
          handleMouseMove as unknown as EventListener
        );
        timelineMainElement.removeEventListener(
          "mouseup",
          handleMouseUp as EventListener
        );
        timelineMainElement.removeEventListener(
          "mouseleave",
          handleMouseLeave as EventListener
        );
      }
    };
  }, [handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave]);

  // Логика определения общего диапазона дат и генерации заголовка таймлайна/сетки
  const {
    overallMinDate,
    overallMaxDate,
    timelineHeaderElements,
    totalTimelineWidth,
    numGridLines,
  } = useMemo(() => {
    let minDate: Date = new Date(8640000000000000); // Максимально возможная дата
    let maxDate: Date = new Date(-8640000000000000); // Минимально возможная дата

    // Проверяем, есть ли элементы для расчета диапазона
    if (timelineItems.length > 0) {
      timelineItems.forEach((item) => {
        const start = new Date(item.startDate);
        const end = item.endDate ? new Date(item.endDate) : new Date(); // Если endDate null, используем текущую дату
        if (start < minDate) minDate = start;
        if (end > maxDate) maxDate = end;
      });
      // Расширяем диапазон на 1 месяц до и 2 месяца после для видимости
      minDate = new Date(minDate.getFullYear(), minDate.getMonth() - 1, 1);
      maxDate = new Date(maxDate.getFullYear(), maxDate.getMonth() + 2, 0); // 0-й день следующего месяца = последний день текущего
    } else {
      // Если нет элементов, показываем диапазон вокруг текущей даты
      const today = new Date();
      minDate = new Date(today.getFullYear(), today.getMonth() - 6, 1);
      maxDate = new Date(today.getFullYear(), today.getMonth() + 7, 0);
    }

    // Корректируем, если minDate почему-то стала больше maxDate
    if (minDate.getTime() > maxDate.getTime()) {
      minDate = new Date(maxDate.getFullYear(), maxDate.getMonth() - 12, 1); // Откатываемся на год назад от maxDate
    }

    // Обнуляем время для корректных расчетов по дням
    minDate.setHours(0, 0, 0, 0);
    maxDate.setHours(0, 0, 0, 0);

    const headerElements: JSX.Element[] = [];
    let currentYear: number = -1;
    let currentMonthsInYear: JSX.Element[] = [];
    let calculatedTotalWidth: number = 0;

    // Генерируем заголовки месяцев и годов
    for (let d = new Date(minDate); ; d.setMonth(d.getMonth() + 1)) {
      // Убедимся, что мы всегда начинаем с 1-го числа месяца
      if (d.getDate() !== 1) {
        d.setDate(1);
        // Проверяем, не перескочили ли мы maxDate после установки даты на 1-е число
        if (
          d.getFullYear() > maxDate.getFullYear() ||
          (d.getFullYear() === maxDate.getFullYear() &&
            d.getMonth() > maxDate.getMonth())
        )
          break;
      }

      // Условие выхода из цикла: если текущая дата перевалила за maxDate
      // или если она совпадает с maxDate, но мы уже обработали этот месяц
      if (
        d > maxDate &&
        !(
          d.getFullYear() === maxDate.getFullYear() &&
          d.getMonth() === maxDate.getMonth()
        )
      )
        break;

      const year = d.getFullYear();
      const monthIndex = d.getMonth();

      if (year !== currentYear) {
        // Если сменился год, добавляем предыдущий год и его месяцы в headerElements
        if (currentYear !== -1) {
          headerElements.push(
            <div
              key={currentYear}
              className="flex flex-col items-center flex-shrink-0"
              style={{ width: `${currentMonthsInYear.length * MONTH_WIDTH_PX}px` }}
            >
              <div className="w-full text-center py-[5px] pb-[7px] text-base border-b border-[#4a637a] h-[28px] box-border font-bold text-gray-100 border-r border-[#5f7081] flex items-center justify-center bg-gradient-to-b from-[#34495e] to-[#2c3e50]">
                {currentYear}
              </div>
              <div className="flex h-[calc(54px-28px)] w-full">
                {currentMonthsInYear}
              </div>
            </div>
          );
        }
        currentYear = year;
        currentMonthsInYear = [];
      }

      currentMonthsInYear.push(
        <div
          key={`${year}-${monthIndex}`}
          className="timeline-month flex-shrink-0 flex items-center justify-center border-r border-[#4a637a] font-medium text-[#bdc3c7] text-[1em]"
          style={{ width: `${MONTH_WIDTH_PX}px` }}
        >
          {MONTH_NAMES_SHORT[monthIndex]}
        </div>
      );
      calculatedTotalWidth += MONTH_WIDTH_PX;

      // Если d уже на месяц впереди maxDate, прерываем цикл после добавления текущего месяца
      if (
        d.getFullYear() === maxDate.getFullYear() &&
        d.getMonth() === maxDate.getMonth()
      ) {
        // Чтобы учесть последний месяц maxDate
        // Но прерывать, если мы уже добавили месяц, который является или перевалил maxDate
        // Это условие уже должно быть обработано выше.
        // Просто убедимся, что мы не пересчитали месяцы
      }
    }

    // Добавляем последний год и его месяцы после выхода из цикла
    if (currentYear !== -1) {
      headerElements.push(
        <div
          key={currentYear}
          className="flex flex-col items-center flex-shrink-0"
          style={{ width: `${currentMonthsInYear.length * MONTH_WIDTH_PX}px` }}
        >
          <div className="w-full text-center py-[5px] pb-[7px] text-base border-b border-[#4a637a] h-[28px] box-border font-bold text-gray-100 border-r border-[#5f7081] flex items-center justify-center bg-gradient-to-b from-[#34495e] to-[#2c3e50]">
            {currentYear}
          </div>
          <div className="flex h-[calc(54px-28px)] w-full">
            {currentMonthsInYear}
          </div>
        </div>
      );
    }

    // Обеспечиваем минимальную ширину таймлайна, если нет элементов
    // Или если диапазон дат слишком мал. Показываем хотя бы 12 месяцев.
    if (calculatedTotalWidth < MONTH_WIDTH_PX * 12) {
      // Пересчитываем количество месяцев в диапазоне minDate-maxDate
      const monthsInMinMaxRange =
        (maxDate.getFullYear() - minDate.getFullYear()) * 12 +
        maxDate.getMonth() -
        minDate.getMonth() +
        1;
      calculatedTotalWidth = Math.max(monthsInMinMaxRange, 12) * MONTH_WIDTH_PX;
    }

    const calculatedNumGridLines = Math.max(
      1,
      Math.floor(calculatedTotalWidth / MONTH_WIDTH_PX)
    );

    return {
      overallMinDate: minDate,
      overallMaxDate: maxDate,
      timelineHeaderElements: headerElements,
      totalTimelineWidth: calculatedTotalWidth,
      numGridLines: calculatedNumGridLines,
    };
  }, [timelineItems]); // Пересчитываем только при изменении timelineItems

  // Позиционирование линии "Сегодня"
  const positionTodayLine = useCallback((): void => {
    const todayLineElement = todayLineRef.current;
    // Проверяем, что все необходимые данные для расчета существуют
    if (
      !todayLineElement ||
      !overallMinDate ||
      !overallMaxDate ||
      isNaN(overallMinDate.getTime()) ||
      isNaN(overallMaxDate.getTime())
    ) {
      if (todayLineElement) todayLineElement.style.display = "none"; // Скрываем, если данных нет
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Если "Сегодня" вне диапазона, скрываем линию
    if (today < overallMinDate || today > overallMaxDate) {
      todayLineElement.style.display = "none";
      return;
    }

    todayLineElement.style.display = "block"; // Показываем линию

    // Разница в миллисекундах между "Сегодня" и началом общего диапазона
    const startOffsetMs = Math.max(
      0,
      today.getTime() - overallMinDate.getTime()
    );

    // Вычисляем более точное количество дней в месяце для расчета позиции
    // Это просто среднее значение, для точного расчета нужно учитывать количество дней в каждом месяце.
    // Однако, для визуальной "линии дня", среднее значение обычно достаточно.
    const avgDaysPerMonth = 30.4375; // 365.25 / 12

    // Расчет позиции в пикселях:
    // (Разница в днях от minDate / Среднее кол-во дней в месяце) * Ширина месяца в пикселях
    const daysFromMinDate = startOffsetMs / (1000 * 60 * 60 * 24);
    const leftPositionPx = (daysFromMinDate / avgDaysPerMonth) * MONTH_WIDTH_PX;

    todayLineElement.style.left = `${leftPositionPx}px`;
  }, [overallMinDate, overallMaxDate]);

  // Эффект для позиционирования линии "Сегодня" при изменении данных или рендере
  useEffect(() => {
    positionTodayLine();
    // Можно добавить window.addEventListener('resize', positionTodayLine);
    // и его cleanup при необходимости, если MONTH_WIDTH_PX будет динамическим.
  }, [positionTodayLine, timelineItems]); // Зависит от positionTodayLine и timelineItems для пересчета

  // **** ИЗМЕНЕННЫЙ handleAddItem для взаимодействия с бэкендом ****
  const handleAddItem = async (): Promise<void> => {
    if (!itemName || !itemStartDate || !itemGroup) {
      alert("Пожалуйста, заполните название, группу и дату начала.");
      return;
    }

    const start = new Date(itemStartDate);
    const end = itemEndDate ? new Date(itemEndDate) : null;

    if (end && end < start) {
      alert("Дата окончания не может быть раньше даты начала.");
      return;
    }

    try {
      const newItemData = {
        group: itemGroup,
        name: itemName,
        start_date: itemStartDate,
        end_date: itemEndDate || null, // Отправляем null, если дата окончания не указана
      };

      const response = await fetch(`${API_BASE_URL}/api/v1/timeline`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newItemData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `Failed to add item: ${response.status} ${response.statusText} - ${
            JSON.stringify(errorData.detail) || "Unknown error"
          }`
        );
      }

      const responseData = await response.json();
      // Convert snake_case from API to camelCase for our frontend
      const addedItem: TimelineItem = {
        id: responseData.id,
        group: responseData.group,
        name: responseData.name,
        startDate: responseData.start_date,
        endDate: responseData.end_date
      };
      setTimelineItems((prevItems) => [...prevItems, addedItem]); // Добавляем новый элемент, полученный от бэкенда (с ID)

      // Очищаем форму
      setItemName("");
      setItemStartDate("");
      setItemEndDate("");
      setItemGroup("Профессии"); // Сброс группы на дефолтное значение
    } catch (error) {
      console.error("Error adding timeline item:", error);
      alert(
        `Ошибка при добавлении элемента: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  };

  // Обработчик для переключения групп
  const toggleGroup = useCallback((groupName: string): void => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName], // Инвертируем состояние для этой группы
    }));
  }, []);

  // Группировка и сортировка элементов для отрисовки
  const sortedAndGroupedItems = useMemo(() => {
    const sortedItems = [...timelineItems].sort(
      (a, b) =>
        new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );

    const grouped: { [key: string]: TimelineItem[] } = sortedItems.reduce(
      (acc, item) => {
        acc[item.group] = acc[item.group] || [];
        acc[item.group].push(item);
        return acc;
      },
      {} as { [key: string]: TimelineItem[] }
    ); // Указываем тип для аккумулятора

    return Object.keys(grouped)
      .sort()
      .map((groupName) => ({
        groupName,
        items: grouped[groupName],
      }));
  }, [timelineItems]); // Зависит от timelineItems

  // Функция для прокрутки к текущей дате
  const scrollToToday = useCallback((): void => {
    const todayLineElement = todayLineRef.current;
    const timelineMainElement = timelineMainRef.current;
    
    if (todayLineElement && timelineMainElement) {
      const todayPosition = parseFloat(todayLineElement.style.left);
      const containerWidth = timelineMainElement.clientWidth;
      
      // Прокручиваем, чтобы линия "сегодня" была примерно в центре
      timelineMainElement.scrollLeft = Math.max(0, todayPosition - containerWidth / 2);
    }
  }, []);

  // Прокрутка к текущей дате при первом рендере
  useEffect(() => {
    // Даем время на рендеринг и позиционирование линии "сегодня"
    const timer = setTimeout(() => {
      scrollToToday();
    }, 500);
    return () => clearTimeout(timer);
  }, [scrollToToday, timelineItems]);

  return (
    <div className="app-container max-w-[1800px] mx-auto p-5 font-roboto bg-[#1a2634] text-[#ecf0f1] text-sm leading-relaxed min-h-screen">
      <h1 className="main-title text-[#e0e0e0] text-center mb-[25px] font-medium text-2xl">
        Мой Таймлайн
      </h1>
      {/* Форма добавления элемента */}
      <div className="add-item-form-container bg-[#2c3e50] p-5 mb-6 rounded-lg flex flex-wrap gap-4 items-center shadow-lg border border-[#3d5166] backdrop-blur-sm bg-opacity-90">
        <span className="add-item-label font-medium text-[#bdc3c7] mr-1.5 text-base">
          Добавить элемент
        </span>
        <input
          type="text"
          id="itemName"
          placeholder="Название (профессия, задача и т.д.)"
          className="p-3 border border-[#566573] bg-[#1c2834] text-[#ecf0f1] rounded-md flex-grow-[2] min-w-[150px] placeholder:text-[#7f8c8d] focus:outline-none focus:ring-2 focus:ring-[#3498db] transition-all duration-200"
          value={itemName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setItemName(e.target.value)
          }
        />
        <select
          id="itemGroup"
          className="p-3 border border-[#566573] bg-[#1c2834] text-[#ecf0f1] rounded-md flex-grow min-w-[150px] focus:outline-none focus:ring-2 focus:ring-[#3498db] transition-all duration-200"
          value={itemGroup}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            setItemGroup(e.target.value)
          }
        >
          <option value="Профессии">Профессии</option>
          <option value="Путешествия">Путешествия</option>
          <option value="Проекты">Проекты</option>
          <option value="Образование">Образование</option>
          <option value="Личное">Личное</option>
        </select>
        <input
          type="date"
          id="itemStartDate"
          title="Дата начала"
          className="p-3 border border-[#566573] bg-[#1c2834] text-[#ecf0f1] rounded-md flex-grow min-w-[150px] focus:outline-none focus:ring-2 focus:ring-[#3498db] transition-all duration-200"
          value={itemStartDate}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setItemStartDate(e.target.value)
          }
        />
        <input
          type="date"
          id="itemEndDate"
          title="Дата окончания (пусто = по н.в.)"
          className="p-3 border border-[#566573] bg-[#1c2834] text-[#ecf0f1] rounded-md flex-grow min-w-[150px] focus:outline-none focus:ring-2 focus:ring-[#3498db] transition-all duration-200"
          value={itemEndDate}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setItemEndDate(e.target.value)
          }
        />
        <button
          id="addItemBtn"
          className="p-3 px-5 bg-gradient-to-r from-[#2980b9] to-[#3498db] text-white border-none rounded-md cursor-pointer font-medium transition-all duration-200 hover:from-[#3498db] hover:to-[#2ecc71] hover:shadow-lg active:translate-y-[1px]"
          onClick={handleAddItem}
        >
          Добавить
        </button>
      </div>
      
      {/* Кнопки управления таймлайном */}
      <div className="timeline-controls flex justify-end mb-2 gap-2">
        <button 
          onClick={scrollToToday}
          className="p-2 px-4 bg-gradient-to-r from-[#34495e] to-[#2c3e50] text-white border border-[#3d5166] rounded-md cursor-pointer font-medium transition-all duration-200 hover:from-[#2c3e50] hover:to-[#34495e] hover:shadow-md active:translate-y-[1px] text-sm flex items-center gap-2"
        >
          <span className="inline-block w-2 h-2 bg-[#e74c3c] rounded-full"></span>
          Сегодня
        </button>
      </div>
      
      {/* Обертка для таймлайна */}
      <div className="timeline-wrapper bg-[#2c3e50] border border-[#3d5166] rounded-lg overflow-hidden shadow-2xl backdrop-blur-sm bg-opacity-95">
        <div className="timeline-container flex">
          {/* Левая боковая панель (sidebar) */}
          <div className="timeline-sidebar min-w-[380px] border-r border-[#3d5166] bg-[#1c2834] flex-shrink-0">
            {/* Заголовок сайдбара */}
            <div className="sidebar-header flex items-center px-4 border-b border-[#3d5166] box-border h-[54px] text-[1.05em] font-medium bg-gradient-to-r from-[#2c3e50] to-[#34495e] text-[#ecf0f1] sticky top-0 z-10 shadow-md">
              <div className="header-name flex-none w-[170px] overflow-hidden text-ellipsis whitespace-nowrap pr-2.5 uppercase tracking-wider border-r border-[#4a637a] pl-2">
                Название
              </div>
              <div className="header-date-range flex-none w-[130px] text-center text-[#ecf0f1] uppercase tracking-wider border-r border-[#4a637a]">
                Период
              </div>
              <div className="header-duration flex-none w-[80px] text-right pr-3 text-[#ecf0f1] uppercase tracking-wider">
                Дней
              </div>
            </div>
            {/* Элементы сайдбара */}
            <div className="sidebar-items">
              {sortedAndGroupedItems.map((group) => (
                <React.Fragment key={group.groupName}>
                  {/* Заголовок группы в сайдбаре */}
                  <div
                    className="timeline-group-header bg-gradient-to-r from-[#2c3e50] to-[#34495e] font-medium cursor-pointer transition-colors duration-200 hover:from-[#34495e] hover:to-[#4a5568] flex items-center px-4 border-b border-[#3d5166] box-border h-[54px] text-[1.1em]"
                    onClick={() => toggleGroup(group.groupName)}
                  >
                    <span className="group-name flex-grow font-bold text-[#e0e0e0]">
                      {group.groupName}
                    </span>
                    <span
                      className={`toggler ml-auto px-1.5 text-lg text-[#95a5a6] transition-transform duration-300 ${
                        collapsedGroups[group.groupName]
                          ? "rotate-[-90deg]"
                          : "rotate-0"
                      }`}
                    >
                      {collapsedGroups[group.groupName] ? "►" : "▼"}
                    </span>
                  </div>
                  {/* Элементы группы в сайдбаре */}
                  {!collapsedGroups[group.groupName] &&
                    group.items.map((item) => {
                      const days = getDaysBetween(item.startDate, item.endDate);
                      return (
                        <div
                          key={item.id}
                          className="sidebar-item-row flex items-center px-4 border-b border-[#3d5166] box-border h-[54px] text-[1em] transition-all duration-200 hover:bg-[#253443]"
                        >
                          {/* Маркер "•" реализован с помощью отдельного span для JSX совместимости */}
                          <div className="item-name sub-item flex-none w-[170px] overflow-hidden text-ellipsis whitespace-nowrap pr-2.5 pl-5 relative text-[1.05em] border-r border-[#3d5166]">
                            <span className="absolute left-[8px] top-1/2 -translate-y-1/2 text-[#3498db] text-[1.1em]">
                              {" "}
                              •{" "}
                            </span>
                            {item.name}
                          </div>
                          <div className="item-date-range flex-none w-[130px] text-center text-[#bdc3c7] text-[1.05em] border-r border-[#3d5166]">
                            {formatDate(item.startDate)} &mdash;{" "}
                            {item.endDate ? formatDate(item.endDate) : "н.в."}
                          </div>
                          <div className="item-duration flex-none w-[80px] text-right pr-3 text-[#3498db] font-medium text-[1.05em]">
                            {getReadableDuration(days)}
                          </div>
                        </div>
                      );
                    })}
                </React.Fragment>
              ))}
            </div>
          </div>
          {/* Правая основная панель (timeline-main) */}
          <div
            ref={timelineMainRef}
            className={`timeline-main flex-grow overflow-x-auto relative cursor-grab select-none ${
              isDragging ? "cursor-grabbing" : ""
            } scrollbar-thin scrollbar-thumb-[#3d5166] scrollbar-track-[#1c2834]`}
          >
            {/* Заголовок таймлайна (годы и месяцы) */}
            <div className="timeline-header sticky top-0 bg-gradient-to-r from-[#2c3e50] to-[#34495e] z-10 border-b border-[#3d5166] h-[54px] shadow-md">
              <div className="flex" style={{ width: `${totalTimelineWidth}px` }}>{timelineHeaderElements}</div>
            </div>
            {/* Тело таймлайна */}
            <div className="timeline-body relative">
              {/* Линия текущей даты */}
              <div
                id="today-line"
                ref={todayLineRef}
                className="today-line absolute top-0 h-full w-[3px] bg-gradient-to-b from-[#e74c3c] to-[#c0392b] z-20 pointer-events-none shadow-[0_0_12px_rgba(231,76,60,0.8)] animate-pulse"
                style={{ left: "0px" }}
              ></div>
              {sortedAndGroupedItems.map((group) => (
                <React.Fragment key={`timeline-${group.groupName}`}>
                  {/* Строка заголовка группы в таймлайне */}
                  <div
                    className="timeline-group-row bg-gradient-to-r from-[#2c3e50] to-[#34495e] border-b border-[#3d5166] box-border relative"
                    style={{
                      height: `${ROW_HEIGHT_PX}px`,
                      width: `${totalTimelineWidth}px`,
                    }}
                  >
                    <div className="grid-container absolute top-0 left-0 w-full h-full flex">
                      {Array.from({ length: numGridLines }).map((_, i) => (
                        <div
                          key={i}
                          className="month-grid-line h-full border-r border-[#3d5166] box-border flex-shrink-0"
                          style={{ width: `${MONTH_WIDTH_PX}px` }}
                        ></div>
                      ))}
                    </div>
                  </div>
                  {/* Строки элементов в таймлайне */}
                  {!collapsedGroups[group.groupName] &&
                    group.items.map((item) => {
                      const normalizedItemStartDate = new Date(item.startDate);
                      normalizedItemStartDate.setHours(0, 0, 0, 0); // Обнуляем время

                      const avgDaysPerMonth = 30.4375; // Среднее количество дней в месяце

                      // Отступ от начала общего диапазона в пикселях
                      const startOffsetMs = Math.max(
                        0,
                        normalizedItemStartDate.getTime() -
                          overallMinDate.getTime()
                      );

                      let barDurationDaysForVisual: number;
                      const todayForBarCalcs = new Date();
                      todayForBarCalcs.setHours(0, 0, 0, 0);

                      if (item.endDate === null) {
                        // Если дата окончания не указана, считаем до текущей даты
                        const diffMs =
                          todayForBarCalcs.getTime() -
                          normalizedItemStartDate.getTime();
                        const durationInDaysFloat =
                          diffMs / (1000 * 60 * 60 * 24);
                        if (diffMs < 0) {
                          // Если начало в будущем
                          barDurationDaysForVisual = 0;
                        } else if (diffMs === 0) {
                          // Если сегодня - день начала
                          barDurationDaysForVisual = 1;
                        } else {
                          barDurationDaysForVisual = durationInDaysFloat + 1; // Включаем текущий день
                        }
                      } else {
                        const visualBarEndDate = new Date(item.endDate);
                        visualBarEndDate.setHours(0, 0, 0, 0);
                        let durationMs =
                          visualBarEndDate.getTime() -
                          normalizedItemStartDate.getTime();
                        if (durationMs < 0) {
                          // Если дата окончания раньше даты начала
                          barDurationDaysForVisual = 0;
                        } else if (durationMs === 0) {
                          // Если начало и конец в один день
                          barDurationDaysForVisual = 1;
                        } else {
                          barDurationDaysForVisual =
                            durationMs / (1000 * 60 * 60 * 24) + 1; // Включаем оба дня
                        }
                      }
                      
                      let barStartOffsetPx =
                        (startOffsetMs /
                          (1000 * 60 * 60 * 24) /
                          avgDaysPerMonth) *
                        MONTH_WIDTH_PX;
                        
                      let barWidthPx =
                        (barDurationDaysForVisual / avgDaysPerMonth) *
                        MONTH_WIDTH_PX;
                        
                      // Make 1-day events have a proper width to be visible and center them on their date
                      if (barDurationDaysForVisual === 1) {
                        barWidthPx = 5; // Fixed width of 10px for 1-day events
                        barStartOffsetPx = barStartOffsetPx - (barWidthPx / 2) + 1.5; // Center the bar on the date with slight adjustment
                      }

                      return (
                        <div
                          key={`timeline-row-${item.id}`}
                          className="timeline-row border-b border-[#3d5166] box-border relative transition-colors duration-200 hover:bg-[rgba(255,255,255,0.05)]"
                          style={{
                            height: `${ROW_HEIGHT_PX}px`,
                            width: `${totalTimelineWidth}px`,
                          }}
                        >
                          <div className="grid-container absolute top-0 left-0 w-full h-full flex">
                            {Array.from({ length: numGridLines }).map((_, i) => (
                              <div
                                key={i}
                                className="month-grid-line h-full border-r border-[#3d5166] box-border flex-shrink-0"
                                style={{ width: `${MONTH_WIDTH_PX}px` }}
                              ></div>
                            ))}
                          </div>
                          {/* Бар события */}
                          {barWidthPx > 0.1 && ( // Рендерим бар только если его ширина значима
                            <div
                              className="timeline-bar absolute h-[75%] top-1/2 -translate-y-1/2 rounded-md shadow-[0_2px_10px_rgba(0,0,0,0.3)] min-w-[3px] z-5 transition-all duration-300 flex items-center justify-center text-white text-[0.9em] whitespace-nowrap overflow-hidden border border-white/10"
                              style={{
                                left: `${barStartOffsetPx}px`,
                                width: `${Math.min(barWidthPx, totalTimelineWidth - barStartOffsetPx - 10)}px`, // Prevent extending beyond timeline
                                background: barDurationDaysForVisual === 1 
                                  ? (item.endDate 
                                      ? `linear-gradient(to right, #ff7f00, #ff5500)` // Яркий оранжевый для однодневных завершенных
                                      : `linear-gradient(to right, #2ecc71, #27ae60)`) // Яркий зеленый для однодневных текущих
                                  : (item.endDate 
                                      ? `linear-gradient(to right, #e67e22, #d35400)` // Стандартный оранжевый для завершенных
                                      : `linear-gradient(to right, #27ae60, #229954)`), // Стандартный зеленый для текущих
                                opacity: "1",
                                boxShadow: barDurationDaysForVisual === 1 ? "0 0 8px rgba(255,127,0,0.6)" : "" // Добавляем свечение для однодневных
                              }}
                              onMouseOver={(e) => {
                                e.currentTarget.style.background = barDurationDaysForVisual === 1
                                  ? (item.endDate
                                      ? `linear-gradient(to right, #ff9f00, #ff7000)` // Яркий оранжевый ховер для однодневных
                                      : `linear-gradient(to right, #33dd81, #2ecc71)`) // Яркий зеленый ховер для однодневных
                                  : (item.endDate
                                      ? `linear-gradient(to right, #e67e22, #a04000)` // Стандартный оранжевый ховер
                                      : `linear-gradient(to right, #27ae60, #196f3d)`); // Стандартный зеленый ховер
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.background = barDurationDaysForVisual === 1
                                  ? (item.endDate
                                      ? `linear-gradient(to right, #ff7f00, #ff5500)` // Яркий оранжевый для однодневных
                                      : `linear-gradient(to right, #2ecc71, #27ae60)`) // Яркий зеленый для однодневных
                                  : (item.endDate
                                      ? `linear-gradient(to right, #e67e22, #d35400)` // Стандартный оранжевый
                                      : `linear-gradient(to right, #27ae60, #229954)`); // Стандартный зеленый
                              }}
                            >
                              {/* Text content removed */}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimelineApp;
