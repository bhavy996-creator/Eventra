import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/prisma.js";
import { buildSeats } from "../src/seats.js";

const daysFromNow = (d, hour = 19) => {
  const t = new Date();
  t.setDate(t.getDate() + d);
  t.setHours(hour, 0, 0, 0);
  return t;
};

async function main() {
  // wipe old demo data (order matters because of relations)
  await prisma.ticket.deleteMany();
  await prisma.seat.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();

  const pw = await bcrypt.hash("password123", 10);
  await prisma.user.create({ data: { name: "Admin", email: "admin@eventra.com", password: pw, role: "ADMIN" } });
  const org = await prisma.user.create({ data: { name: "Rhythm Events", email: "organizer@eventra.com", password: pw, role: "ORGANIZER" } });
  await prisma.user.create({ data: { name: "Demo Customer", email: "customer@eventra.com", password: pw, role: "CUSTOMER" } });

  const events = [
    { title: "Arijit Singh Live in Concert", category: "Music", venue: "JLN Stadium", city: "Delhi", d: 12, price: 1499, vip: 4999, rows: 8, per: 12, vipRows: 2,
      img: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=900", desc: "A magical evening of soulful Bollywood hits performed live with a full orchestra." },
    { title: "Stand-Up Night with Zakir Khan", category: "Comedy", venue: "Siri Fort Auditorium", city: "Delhi", d: 6, price: 799, vip: 1999, rows: 6, per: 10, vipRows: 1,
      img: "https://images.unsplash.com/photo-1585699324551-f6c309eedeca?w=900", desc: "Brand new material. Come ready to laugh until it hurts." },
    { title: "Tech Summit 2026", category: "Conference", venue: "Pragati Maidan", city: "Delhi", d: 20, price: 999, vip: 2999, rows: 6, per: 10, vipRows: 1,
      img: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=900", desc: "Talks, workshops and networking with engineers and founders from across India." },
    { title: "IPL Fan Night Screening", category: "Sports", venue: "Phoenix Mall Arena", city: "Mumbai", d: 4, price: 499, vip: 1499, rows: 5, per: 10, vipRows: 1,
      img: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=900", desc: "Watch the big match on a giant screen with food, fan games and prizes." },
    { title: "Classical Dance Festival", category: "Arts", venue: "Kamani Auditorium", city: "Delhi", d: 15, price: 599, vip: 1599, rows: 5, per: 8, vipRows: 1,
      img: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=900", desc: "Kathak, Bharatanatyam and Odissi performances by renowned artists." },
    { title: "Startup Pitch Battle", category: "Conference", venue: "T-Hub", city: "Hyderabad", d: 9, price: 299, vip: 999, rows: 4, per: 10, vipRows: 1,
      img: "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=900", desc: "20 startups, 5 minutes each, one winner. Watch the pitches live and vote." },
  ];

  for (const e of events) {
    const created = await prisma.event.create({
      data: { title: e.title, description: e.desc, category: e.category, venue: e.venue, city: e.city,
        date: daysFromNow(e.d), imageUrl: e.img, price: e.price, vipPrice: e.vip, organizerId: org.id },
    });
    await prisma.seat.createMany({
      data: buildSeats({ eventId: created.id, rows: e.rows, perRow: e.per, vipRows: e.vipRows, price: e.price, vipPrice: e.vip }),
    });
  }
  console.log("Seeded! Logins (password: password123): admin@eventra.com, organizer@eventra.com, customer@eventra.com");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());