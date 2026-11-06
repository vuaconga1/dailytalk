import Link from "next/link";
import { requireStaff } from "@/server/http/page-guards";
import { prisma } from "@/server/db";
import { formatVnDate } from "@/lib/time";
import { messagingWindowHours, zaloConfigured } from "@/server/integrations/zalo";

const LABELS = { PENDING: "Đang chờ", SENT: "Đã gửi", SKIPPED: "Bỏ qua", FAILED: "Lỗi" } as const;

export default async function NotificationsPage() {
  await requireStaff("viewNotifications");
  const [rows, linked] = await Promise.all([
    prisma.notification.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.zaloLink.count({ where: { followed: true } }),
  ]);

  return (
    <section>
      <div className="eyebrow">ZALO OA</div>
      <h1 className="page-title mb-2">Tin nhắn nhắc học.</h1>
      <p className="mb-6 text-muted">
        {zaloConfigured() ? "Zalo OA đã cấu hình." : "Zalo OA chưa cấu hình – đang chạy thử (không gửi thật)."} {linked} học viên
        đã liên kết. Tin tư vấn chỉ gửi được trong {messagingWindowHours()} giờ sau lần học viên tương tác cuối.
      </p>
      <article className="card overflow-x-auto !p-0">
        <table className="data-table">
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Học viên</th>
              <th>Loại</th>
              <th>Trạng thái</th>
              <th>Nội dung</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((n) => (
              <tr key={n.id}>
                <td>{formatVnDate(n.localDate)}</td>
                <td>
                  <Link href={`/admin/learners/${n.user.id}`} className="text-teal">
                    {n.user.name}
                  </Link>
                </td>
                <td className="text-muted">{n.kind}</td>
                <td>
                  <span className={`badge ${n.status === "SENT" ? "" : "badge-gold"}`}>{LABELS[n.status]}</span>
                  {n.reason && <small className="mt-1 block max-w-[260px] text-muted">{n.reason}</small>}
                </td>
                <td className="max-w-[420px] text-xs whitespace-pre-line text-muted">{n.text}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-muted">
                  Chưa có tin nhắn nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </article>
    </section>
  );
}
