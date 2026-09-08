"use client";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  Minus,
  ShoppingBag,
  Clock,
  Check,
  Leaf,
  UtensilsCrossed,
  Settings2,
  X,
  LogOut,
  ChevronRight,
  LoaderCircle,
  CalendarDays,
  CheckCircle2,
  LockKeyhole,
  History,
  Wallet,
  Users,
  Search,
} from "lucide-react";
const money = (n) => new Intl.NumberFormat("ru-RU").format(n) + " ₸";
const time = (n) =>
  String(Math.floor(n / 60)).padStart(2, "0") +
  ":" +
  String(n % 60).padStart(2, "0");
const KASPI = "https://qr.kaspi.kz/19260255384498956160942079613706100468076";
async function api(path, method = "GET", body) {
  const response = await fetch("/api/" + path, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Не удалось загрузить данные.");
  return data;
}
function FoodArt({ type = "bowl", small = false }) {
  return (
    <div
      className={"food-art " + type + (small ? " small" : "")}
      aria-hidden="true"
    >
      <div className="plate">
        <div className="food-grain" />
        <div className="food-protein" />
        <div className="food-greens">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="food-tomato" />
        <div className="food-herb" />
      </div>
      <span className="art-sprig">✳</span>
    </div>
  );
}
export default function LunchApp() {
  const [view, setView] = useState("menu"),
    [filter, setFilter] = useState("all"),
    [data, setData] = useState(null),
    [cart, setCart] = useState({}),
    [orders, setOrders] = useState([]),
    [isAdmin, setAdmin] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [login, setLogin] = useState(false),
    [pin, setPin] = useState(""),
    [name, setName] = useState(""),
    [note, setNote] = useState(""),
    [paid, setPaid] = useState(false),
    [success, setSuccess] = useState(null),
    [editor, setEditor] = useState(null),
    [days, setDays] = useState([]),
    [selectedDay, setSelectedDay] = useState(""),
    [now, setNow] = useState(new Date()),
    [requestId, setRequestId] = useState("");
  useEffect(() => {
    setName(localStorage.getItem("sherbet_name") || "");
    setRequestId(crypto.randomUUID());
    refresh();
    const t = setInterval(() => {
      setNow(new Date());
      refresh(false);
    }, 30000);
    return () => clearInterval(t);
  }, []);
  async function refresh(clear = true) {
    try {
      const [menu, session] = await Promise.all([api("menu"), api("session")]);
      setData(menu);
      setAdmin(session.admin);
      if (clear) setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    if (view === "orders" || view === "admin") loadOrders();
    if (view === "history")
      api("archive")
        .then((d) => setDays(d.days))
        .catch((e) => setError(e.message));
  }, [view, selectedDay, isAdmin]);
  async function loadOrders() {
    try {
      const r = await api(
        "orders" + (selectedDay ? "?day=" + selectedDay : ""),
      );
      setOrders(r.orders);
    } catch (e) {
      setError(e.message);
    }
  }
  const config = data?.settings || {
    mainClose: 780,
    bakeClose: 780,
    forceOpen: false,
    menuUpdatedDay: "",
  };
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Qyzylorda",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const closed = (kind) =>
    !config.forceOpen &&
    (config.menuUpdatedDay !== data?.day ||
      Number(parts.hour) * 60 + Number(parts.minute) >=
        (kind === "bake" ? config.bakeClose : config.mainClose));
  const all = data?.dishes || [],
    dishes = all.filter(
      (d) => d.active && (filter === "all" || d.kind === filter),
    );
  const items = all
      .filter((d) => cart[d.id] > 0)
      .map((d) => ({ ...d, qty: cart[d.id] })),
    total = items.reduce((s, i) => s + i.price * i.qty, 0),
    count = items.reduce((s, i) => s + i.qty, 0);
  const update = (id, delta) => {
    setCart((c) => ({
      ...c,
      [id]: Math.max(0, Math.min(30, (c[id] || 0) + delta)),
    }));
    setSuccess(null);
    setRequestId(crypto.randomUUID());
  };
  async function action(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function submit(e) {
    e.preventDefault();
    await action(async () => {
      if (data?.demo)
        throw new Error(
          "Это знакомство с интерфейсом. Заказы появятся после подключения базы.",
        );
      const result = await api("orders", "POST", {
        name,
        note,
        paid,
        requestId,
        items: items.map((i) => ({ id: i.id, qty: i.qty })),
      });
      localStorage.setItem("sherbet_name", name);
      setSuccess(result.id);
      setCart({});
      setNote("");
      setPaid(false);
      setRequestId(crypto.randomUUID());
    });
  }
  function nav(next) {
    setView(next);
    setSelectedDay("");
    setError("");
  }
  const date = now.toLocaleDateString("ru-RU", {
    timeZone: "Asia/Qyzylorda",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return (
    <div className="site">
      <header className="header">
        <button
          className="brand"
          onClick={() => nav("menu")}
          aria-label="Sherbet — на главную"
        >
          <span className="brand-icon">
            <UtensilsCrossed size={21} />
          </span>
          Sherbet<span className="brand-dot">.</span>
        </button>
        <nav aria-label="Навигация">
          <button
            className={view === "menu" ? "active" : ""}
            onClick={() => nav("menu")}
          >
            Меню на сегодня
          </button>
          <button
            className={view === "orders" ? "active" : ""}
            onClick={() => nav("orders")}
          >
            Мои заказы
          </button>
          {isAdmin && (
            <button
              className={view === "admin" ? "active" : ""}
              onClick={() => nav("admin")}
            >
              Управление
            </button>
          )}
        </nav>
        <button
          className="admin-link"
          aria-label="Администратор"
          onClick={() => (isAdmin ? nav("admin") : setLogin(true))}
        >
          <Settings2 size={16} />
          <span>Администратор</span>
        </button>
      </header>
      <main>
        <div className="dayline">
          <span>
            <span className="live-dot" /> ОБЕДЫ ДЛЯ НАШЕЙ КОМАНДЫ
          </span>
          <span>
            <CalendarDays size={14} />
            {date}
          </span>
        </div>
        {error && (
          <div className="alert" role="alert">
            {error}
            <button onClick={() => refresh()} className="text-button">
              Повторить
            </button>
            <button aria-label="Закрыть ошибку" onClick={() => setError("")}>
              <X size={16} />
            </button>
          </div>
        )}
        {data?.demo && (
          <div className="demo-banner">
            Предпросмотр Sherbet · блюда показаны для примера, отправка заказов
            отключена.
          </div>
        )}
        {view === "menu" && (
          <>
            <section className="hero">
              <div className="hero-copy">
                <span className="eyebrow">ХОРОШАЯ ЕДА. ХОРОШИЙ ДЕНЬ.</span>
                <h1>
                  Большой день.
                  <br />
                  <em>Вкусный перерыв.</em>
                </h1>
                <p>
                  Домашний обед, который не нужно готовить.
                  <br />
                  Выберите любимое — и возвращайтесь к важному.
                </p>
                <a className="hero-button" href="#menu">
                  Что сегодня на обед <ArrowDown />
                </a>
                <div className="hero-note">
                  <span>
                    <Leaf size={15} /> Готовим на сегодня
                  </span>
                </div>
              </div>
              <div className="hero-visual">
                <span className="orbit-label">СДЕЛАНО С ЗАБОТОЙ</span>
                <FoodArt />
                <div className="floating-label">
                  <span>Ваш любимый перерыв</span>
                  <strong>
                    от 1 000 ₸ <ArrowUpRight size={20} />
                  </strong>
                </div>
                <span className="hero-star">✳</span>
              </div>
            </section>
            <div className="steps">
              <div>
                <span>01</span>
                <p>
                  Выберите обед<small>То, что хочется сегодня</small>
                </p>
              </div>
              <ArrowRight />
              <div>
                <span>02</span>
                <p>
                  Оформите заказ<small>Имя, порции и пожелания</small>
                </p>
              </div>
              <ArrowRight />
              <div>
                <span>03</span>
                <p>
                  Оплатите через Kaspi<small>И наслаждайтесь перерывом</small>
                </p>
              </div>
            </div>
            <div className="order-layout" id="menu">
              <section className="menu-section">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">СВЕЖЕЕ КАЖДЫЙ ДЕНЬ</span>
                    <h2>
                      Сегодня в меню<span>.</span>
                    </h2>
                  </div>
                  <span
                    className={"status " + (closed("main") ? "closed" : "")}
                  >
                    <span className="live-dot" />
                    {config.forceOpen
                      ? "Приём открыт"
                      : closed("main")
                        ? "Приём завершён"
                        : "До " + time(config.mainClose)}
                  </span>
                </div>
                <div className="tabs">
                  <button
                    className={filter === "all" ? "selected" : ""}
                    onClick={() => setFilter("all")}
                  >
                    Всё меню <span>{all.filter((d) => d.active).length}</span>
                  </button>
                  <button
                    className={filter === "main" ? "selected" : ""}
                    onClick={() => setFilter("main")}
                  >
                    Основные блюда
                  </button>
                  <button
                    className={filter === "bake" ? "selected" : ""}
                    onClick={() => setFilter("bake")}
                  >
                    Выпечка
                  </button>
                </div>
                <div className="dish-grid">
                  {!data ? (
                    <div className="empty">
                      <LoaderCircle className="spin" /> Загружаем меню…
                    </div>
                  ) : !dishes.length ? (
                    <div className="empty">
                      <UtensilsCrossed />
                      <h3>Меню скоро появится</h3>
                      <p>Администратор добавит свежие блюда на сегодня.</p>
                      {isAdmin && (
                        <button className="button" onClick={() => nav("admin")}>
                          Добавить блюда
                        </button>
                      )}
                    </div>
                  ) : (
                    dishes.map((d) => (
                      <article className="dish-card" key={d.id}>
                        <div className="dish-picture">
                          <FoodArt type={d.art} />
                          <span className="dish-label">
                            {d.kind === "bake" ? "ИЗ ПЕЧИ" : "ДОМАШНЯЯ КУХНЯ"}
                          </span>
                        </div>
                        <div className="dish-content">
                          <span className="dish-category">
                            {d.kind === "bake" ? "ВЫПЕЧКА" : "ОСНОВНОЕ БЛЮДО"} ·
                            ДО {time(config.mainClose)}
                          </span>
                          <h3>{d.title}</h3>
                          <p>
                            {d.description || "Свежий обед для хорошего дня."}
                          </p>
                          <div className="dish-bottom">
                            <strong>{money(d.price)}</strong>
                            {cart[d.id] ? (
                              <div className="quantity">
                                <button
                                  aria-label={"Убрать порцию " + d.title}
                                  onClick={() => update(d.id, -1)}
                                >
                                  <Minus size={15} />
                                </button>
                                <span>{cart[d.id]}</span>
                                <button
                                  disabled={closed(d.kind)}
                                  aria-label={"Добавить порцию " + d.title}
                                  onClick={() => update(d.id, 1)}
                                >
                                  <Plus size={15} />
                                </button>
                              </div>
                            ) : (
                              <button
                                className="add-button"
                                disabled={closed(d.kind)}
                                onClick={() => update(d.id, 1)}
                              >
                                {closed(d.kind) ? "Закрыто" : "Добавить"}
                                <Plus size={17} />
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    ))
                  )}
                </div>
                <div className="menu-footnote">
                  <Clock size={16} />
                  <span>
                    Приём заказов закрывается в {time(config.mainClose)}
                    <br />
                    <small>
                      Снова откроется после обновления меню · Время Казахстана
                    </small>
                  </span>
                </div>
              </section>
              <aside className="cart" id="cart">
                <div className="cart-heading">
                  <h3>Ваш обед</h3>
                  <span>{count}</span>
                </div>
                {success ? (
                  <div className="success" role="status">
                    <CheckCircle2 size={38} />
                    <h3>Заказ принят!</h3>
                    <p>
                      Обед №{success} уже в списке.
                      <br />
                      Спасибо, что вы с нами.
                    </p>
                    <button className="button" onClick={() => nav("orders")}>
                      Посмотреть заказ <ArrowRight size={16} />
                    </button>
                  </div>
                ) : (
                  <form onSubmit={submit}>
                    {!items.length ? (
                      <div className="cart-empty">
                        <ShoppingBag size={33} strokeWidth={1.2} />
                        <h4>Здесь будет вкусно</h4>
                        <p>
                          Добавьте блюдо из меню,
                          <br />а мы соберём ваш заказ.
                        </p>
                      </div>
                    ) : (
                      <div className="cart-items">
                        {items.map((i) => (
                          <div className="cart-item" key={i.id}>
                            <div>
                              <strong>{i.title}</strong>
                              <small>
                                {money(i.price)} × {i.qty}
                              </small>
                            </div>
                            <button
                              aria-label={"Убрать " + i.title}
                              onClick={() => update(i.id, -i.qty)}
                              type="button"
                            >
                              <X size={15} />
                            </button>
                            <b>{money(i.price * i.qty)}</b>
                          </div>
                        ))}
                      </div>
                    )}
                    <label>
                      Как вас зовут
                      <input
                        required
                        value={name}
                        maxLength={100}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Имя и фамилия"
                        autoComplete="name"
                      />
                    </label>
                    <label>
                      Пожелания <span>необязательно</span>
                      <textarea
                        value={note}
                        maxLength={300}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Например, без лука"
                        rows={2}
                      />
                    </label>
                    <div className="cart-total">
                      <span>Итого</span>
                      <strong>{money(total)}</strong>
                    </div>
                    <a
                      className="kaspi"
                      href={KASPI}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span className="kaspi-mark">K</span>
                      <span>
                        Оплатить в Kaspi
                        <small>Переведите сумму вашего заказа</small>
                      </span>
                      <ArrowUpRight size={19} />
                    </a>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={paid}
                        onChange={(e) => setPaid(e.target.checked)}
                      />
                      <span>Я уже оплатил(а) через Kaspi</span>
                    </label>
                    <button
                      className="button checkout"
                      disabled={busy || !count || data?.demo}
                      type="submit"
                    >
                      {busy ? (
                        <LoaderCircle className="spin" size={18} />
                      ) : (
                        <>
                          Оформить заказ <ArrowRight size={18} />
                        </>
                      )}
                    </button>
                    <p className="cart-note">
                      <LockKeyhole size={11} /> Отметка об оплате подтверждается
                      вами
                    </p>
                  </form>
                )}
              </aside>
            </div>
          </>
        )}
        {view === "orders" && (
          <section className="workspace">
            <span className="eyebrow">ВАШ ВКУСНЫЙ ДЕНЬ</span>
            <h1>
              Мои заказы<span>.</span>
            </h1>
            <p className="muted">
              Заказы, оформленные сегодня в этом браузере.
            </p>
            <OrderList orders={orders} />
            <button className="button" onClick={() => nav("menu")}>
              Вернуться к меню <ArrowRight size={16} />
            </button>
          </section>
        )}
        {view === "admin" && isAdmin && (
          <section className="workspace">
            <div className="section-heading">
              <div>
                <span className="eyebrow">РАБОЧЕЕ МЕСТО АДМИНИСТРАТОРА</span>
                <h1>
                  Всё под контролем<span>.</span>
                </h1>
              </div>
              <button
                className="text-button"
                onClick={() =>
                  action(async () => {
                    await api("session", "DELETE");
                    setAdmin(false);
                    nav("menu");
                    await refresh();
                  })
                }
              >
                <LogOut size={16} /> Выйти
              </button>
            </div>
            <div className="stats">
              <div>
                <Users />
                <strong>{orders.length}</strong>
                <span>заказов сегодня</span>
              </div>
              <div>
                <ShoppingBag />
                <strong>
                  {orders.reduce(
                    (s, o) => s + o.items.reduce((n, i) => n + i.qty, 0),
                    0,
                  )}
                </strong>
                <span>порций для команды</span>
              </div>
              <div>
                <Wallet />
                <strong>
                  {money(orders.reduce((s, o) => s + o.total, 0))}
                </strong>
                <span>сумма заказов</span>
              </div>
            </div>
            <div className="admin-settings">
              <div>
                <h3>Приём заказов</h3>
                <p>
                  Меню открывается после сохранения блюда на сегодня и
                  автоматически закрывается в {time(config.mainClose)}.
                </p>
              </div>
              <span className={"status " + (closed("main") ? "closed" : "")}>
                <span className="live-dot" />
                {closed("main") ? "Закрыто до обновления меню" : "Открыто"}
              </span>
            </div>
            <div className="section-heading">
              <h2>Меню и блюда</h2>
              <button
                className="button"
                onClick={() =>
                  setEditor({
                    title: "",
                    description: "",
                    kind: "main",
                    price: 1000,
                    active: true,
                    art: "bowl",
                  })
                }
              >
                <Plus size={16} /> Добавить блюдо
              </button>
            </div>
            <div className="admin-dishes">
              {all.length ? (
                all.map((d) => (
                  <div className="admin-dish" key={d.id}>
                    <FoodArt type={d.art} small />
                    <div>
                      <strong>{d.title}</strong>
                      <small>
                        {money(d.price)} ·{" "}
                        {d.kind === "main" ? "Основное" : "Выпечка"}
                      </small>
                    </div>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={d.active}
                        disabled={busy}
                        onChange={(e) =>
                          action(async () => {
                            await api("dishes", "POST", {
                              ...d,
                              active: e.target.checked,
                            });
                            await refresh();
                          })
                        }
                      />
                      Сегодня
                    </label>
                    <button
                      className="text-button"
                      onClick={() => setEditor(d)}
                    >
                      Изменить
                    </button>
                  </div>
                ))
              ) : (
                <div className="empty">
                  Добавьте первое блюдо — и откройте меню команде.
                </div>
              )}
            </div>
            <div className="section-heading">
              <h2>Заказы на сегодня</h2>
              <button className="text-button" onClick={() => nav("history")}>
                <History size={16} /> История заказов <ChevronRight size={16} />
              </button>
            </div>
            <KitchenSummary orders={orders} />
            <OrderList orders={orders} />
          </section>
        )}
        {view === "history" && isAdmin && (
          <section className="workspace">
            <span className="eyebrow">НИЧЕГО НЕ ТЕРЯЕТСЯ</span>
            <h1>
              История обедов<span>.</span>
            </h1>
            <button className="text-button" onClick={() => nav("admin")}>
              ← Управление
            </button>
            <div className="history-layout">
              <div>
                {days.length ? (
                  days.map((d) => (
                    <button
                      className={
                        "history-day " + (selectedDay === d.day ? "chosen" : "")
                      }
                      key={d.day}
                      onClick={() => {
                        setSelectedDay(d.day);
                        api("orders?day=" + d.day)
                          .then((r) => setOrders(r.orders))
                          .catch((e) => setError(e.message));
                      }}
                    >
                      <CalendarDays size={19} />
                      <span>
                        {d.day}
                        <small>{d.count} заказов</small>
                      </span>
                      <strong>{money(d.total)}</strong>
                    </button>
                  ))
                ) : (
                  <div className="empty">
                    История появится после первого заказа.
                  </div>
                )}
              </div>
              <div>
                {selectedDay ? (
                  <>
                    <KitchenSummary orders={orders} />
                    <OrderList orders={orders} />
                  </>
                ) : (
                  <div className="empty">
                    Выберите день, чтобы посмотреть заказы.
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </main>
      {view === "menu" && count > 0 && (
        <a className="mobile-cart-bar" href="#cart">
          <ShoppingBag size={20} />
          <span>Ваш обед · {count} порц.</span>
          <strong>{money(total)}</strong>
          <ArrowRight size={18} />
        </a>
      )}
      <footer>
        <div className="brand">
          Sherbet<span className="brand-dot">.</span>
        </div>
        <span>Хорошая еда объединяет.</span>
        <small>С заботой о вашей команде · {now.getFullYear()}</small>
      </footer>
      {login && (
        <div className="modal-backdrop" onClick={() => setLogin(false)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              aria-label="Закрыть"
              onClick={() => setLogin(false)}
            >
              <X />
            </button>
            <span className="modal-icon">
              <LockKeyhole />
            </span>
            <h2 id="login-title">Добро пожаловать.</h2>
            <p>Войдите, чтобы управлять меню и заказами.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                action(async () => {
                  await api("session", "POST", { pin });
                  setPin("");
                  setAdmin(true);
                  setLogin(false);
                  nav("admin");
                  await refresh();
                });
              }}
            >
              <label>
                Пароль администратора
                <input
                  type="password"
                  autoFocus
                  required
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  autoComplete="current-password"
                />
              </label>
              {error && (
                <p role="alert" className="form-error">
                  {error}
                </p>
              )}
              <button disabled={busy} className="button">
                Войти <ArrowRight size={16} />
              </button>
            </form>
          </section>
        </div>
      )}
      {editor && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dish-title"
          >
            <button
              className="modal-close"
              aria-label="Закрыть"
              onClick={() => setEditor(null)}
            >
              <X />
            </button>
            <h2 id="dish-title">
              {editor.id ? "Изменить блюдо" : "Новое блюдо"}
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                action(async () => {
                  await api("dishes", "POST", editor);
                  setEditor(null);
                  await refresh();
                });
              }}
            >
              <label>
                Название
                <input
                  required
                  maxLength={120}
                  value={editor.title}
                  onChange={(e) =>
                    setEditor({ ...editor, title: e.target.value })
                  }
                />
              </label>
              <label>
                Описание
                <textarea
                  maxLength={240}
                  value={editor.description}
                  onChange={(e) =>
                    setEditor({ ...editor, description: e.target.value })
                  }
                />
              </label>
              <div className="form-grid">
                <label>
                  Категория
                  <select
                    value={editor.kind}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        kind: e.target.value,
                        art: e.target.value === "bake" ? "pastry" : "bowl",
                      })
                    }
                  >
                    <option value="main">Основное блюдо</option>
                    <option value="bake">Выпечка</option>
                  </select>
                </label>
                <label>
                  Цена, ₸
                  <input
                    type="number"
                    required
                    min={0}
                    max={100000}
                    step={1}
                    value={editor.price}
                    onChange={(e) =>
                      setEditor({ ...editor, price: Number(e.target.value) })
                    }
                  />
                </label>
              </div>
              <label>
                Иллюстрация
                <select
                  value={editor.art}
                  onChange={(e) =>
                    setEditor({ ...editor, art: e.target.value })
                  }
                >
                  <option value="bowl">Обед с овощами</option>
                  <option value="rice">Плов</option>
                  <option value="salad">Салат</option>
                  <option value="pastry">Выпечка</option>
                </select>
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={editor.active}
                  onChange={(e) =>
                    setEditor({ ...editor, active: e.target.checked })
                  }
                />
                В меню на сегодня
              </label>
              {error && (
                <p role="alert" className="form-error">
                  {error}
                </p>
              )}
              <button className="button" disabled={busy}>
                Сохранить <Check size={16} />
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
function ArrowDown() {
  return <ArrowRight size={18} style={{ transform: "rotate(90deg)" }} />;
}
function OrderList({ orders }) {
  return (
    <div className="order-list">
      {orders.length ? (
        orders.map((o) => (
          <article className="order-row" key={o.id}>
            <div className="order-row-top">
              <strong>{o.customer}</strong>
              <span className={"payment " + (o.paid ? "paid" : "")}>
                {o.paid ? "Оплата отмечена" : "Не оплачено"}
              </span>
              <b>{money(o.total)}</b>
            </div>
            <p>{o.items.map((i) => `${i.title} × ${i.qty}`).join(" · ")}</p>
            {o.note && <blockquote>{o.note}</blockquote>}
            <small>
              Заказ №{o.id} ·{" "}
              {new Date(o.created_at).toLocaleTimeString("ru-RU", {
                timeZone: "Asia/Qyzylorda",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </small>
          </article>
        ))
      ) : (
        <div className="empty">
          <ShoppingBag />
          <h3>Пока без заказов</h3>
          <p>Здесь появится ваш следующий вкусный перерыв.</p>
        </div>
      )}
    </div>
  );
}
function KitchenSummary({ orders }) {
  const summary = {};
  for (const o of orders)
    for (const i of o.items) summary[i.title] = (summary[i.title] || 0) + i.qty;
  return (
    Object.keys(summary).length > 0 && (
      <div className="kitchen">
        <h3>Для кухни</h3>
        {Object.entries(summary).map(([title, qty]) => (
          <span key={title}>
            {title}
            <b>{qty} порц.</b>
          </span>
        ))}
      </div>
    )
  );
}
