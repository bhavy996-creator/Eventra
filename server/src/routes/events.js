import { Router } from "express";
import { prisma } from "../prisma.js";
import { buildSeats } from "../seats.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

// GET /api/events?search=&category=&city=&sort=date|price&maxPrice=
router.get("/", async (req, res) => {
  const { search, category, city, sort, maxPrice } = req.query;
  const where = { date: { gte: new Date() } }; // only upcoming events
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { venue: { contains: search, mode: "insensitive" } },
    ];
  }
  if (category) where.category = category;
  if (city) where.city = { equals: city, mode: "insensitive" };
  if (maxPrice) where.price = { lte: Number(maxPrice) };

  const orderBy = sort === "price" ? { price: "asc" } : { date: "asc" };
  const events = await prisma.event.findMany({
    where,
    orderBy,
    include: { _count: { select: { seats: { where: { status: "AVAILABLE" } } } } },
  });
  res.json(events.map(({ _count, ...e }) => ({ ...e, availableSeats: _count.seats })));
});

// GET /api/events/mine  – organizer sees own events, admin sees all
router.get("/mine", requireAuth, requireRole("ORGANIZER", "ADMIN"), async (req, res) => {
  const where = req.user.role === "ADMIN" ? {} : { organizerId: req.user.id };
  res.json(await prisma.event.findMany({ where, orderBy: { date: "asc" } }));
});

// GET /api/events/meta/filters  – fills the category and city dropdowns
router.get("/meta/filters", async (_req, res) => {
  const [cats, cities] = await Promise.all([
    prisma.event.findMany({ select: { category: true }, distinct: ["category"] }),
    prisma.event.findMany({ select: { city: true }, distinct: ["city"] }),
  ]);
  res.json({ categories: cats.map((c) => c.category), cities: cities.map((c) => c.city) });
});

// GET /api/events/:id
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const event = await prisma.event.findUnique({
    where: { id },
    include: { organizer: { select: { name: true } }, _count: { select: { seats: true } } },
  });
  if (!event) return res.status(404).json({ message: "Event not found" });
  const available = await prisma.seat.count({ where: { eventId: id, status: "AVAILABLE" } });
  res.json({ ...event, totalSeats: event._count.seats, availableSeats: available });
});

// GET /api/events/:id/seats
router.get("/:id/seats", async (req, res) => {
  const seats = await prisma.seat.findMany({
    where: { eventId: Number(req.params.id) },
    select: { id: true, label: true, row: true, number: true, tier: true, price: true, status: true },
    orderBy: [{ row: "asc" }, { number: "asc" }],
  });
  res.json(seats);
});

// POST /api/events  – organizer/admin; also creates the seat map
router.post("/", requireAuth, requireRole("ORGANIZER", "ADMIN"), async (req, res) => {
  const b = req.body;
  if (!b.title || !b.venue || !b.city || !b.date || !b.price) {
    return res.status(400).json({ message: "Title, venue, city, date and price are required" });
  }
  const rows = Math.min(Number(b.rows) || 5, 26);
  const perRow = Math.min(Number(b.perRow) || 10, 30);
  const vipRows = Math.min(Number(b.vipRows) || 0, rows);

  // transaction = either the event AND all its seats are saved, or nothing is
  const event = await prisma.$transaction(async (tx) => {
    const created = await tx.event.create({
      data: {
        title: b.title,
        description: b.description || "",
        category: b.category || "Other",
        venue: b.venue,
        city: b.city,
        date: new Date(b.date),
        imageUrl: b.imageUrl || null,
        price: Number(b.price),
        vipPrice: Number(b.vipPrice || b.price),
        organizerId: req.user.id,
      },
    });
    await tx.seat.createMany({
      data: buildSeats({ eventId: created.id, rows, perRow, vipRows, price: created.price, vipPrice: created.vipPrice }),
    });
    return created;
  });
  res.status(201).json(event);
});

// PUT /api/events/:id  – only the owner (or admin)
router.put("/:id", requireAuth, requireRole("ORGANIZER", "ADMIN"), async (req, res) => {
  const id = Number(req.params.id);
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) return res.status(404).json({ message: "Event not found" });
  if (req.user.role !== "ADMIN" && event.organizerId !== req.user.id) {
    return res.status(403).json({ message: "You can only edit your own events" });
  }
  const b = req.body;
  const data = {};
  for (const k of ["title", "description", "category", "venue", "city", "imageUrl"]) if (b[k] !== undefined) data[k] = b[k];
  if (b.date) data.date = new Date(b.date);
  if (b.price) data.price = Number(b.price);
  if (b.vipPrice) data.vipPrice = Number(b.vipPrice);
  res.json(await prisma.event.update({ where: { id }, data }));
});

// DELETE /api/events/:id
router.delete("/:id", requireAuth, requireRole("ORGANIZER", "ADMIN"), async (req, res) => {
  const id = Number(req.params.id);
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) return res.status(404).json({ message: "Event not found" });
  if (req.user.role !== "ADMIN" && event.organizerId !== req.user.id) {
    return res.status(403).json({ message: "You can only delete your own events" });
  }
  await prisma.ticket.deleteMany({ where: { booking: { eventId: id } } });
  await prisma.seat.updateMany({ where: { eventId: id }, data: { bookingId: null } });
  await prisma.event.delete({ where: { id } });
  res.json({ message: "Event deleted" });
});

export default router;