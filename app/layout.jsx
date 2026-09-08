import "./globals.css";
export const metadata = {
  title: "Sherbet — вкусный перерыв",
  description: "Обеды для команды. Выберите, закажите и встречаемся за столом.",
};
export default function Layout({ children }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
