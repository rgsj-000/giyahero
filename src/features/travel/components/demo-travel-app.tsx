"use client";

/* Source images are extracted from the user's approved GiyaHero export. */
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Bell,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Compass,
  House,
  Info,
  Map,
  MapPin,
  MessageSquare,
  Minus,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  ThumbsUp,
  Ticket,
  Users,
  Wallet,
  X,
} from "lucide-react";
import {
  findPackages,
  packages,
  peso,
  quoteTotal,
  validateTrip,
  type TravelPackage,
} from "../data";
import "./travel.css";

type Screen =
  | "welcome"
  | "home"
  | "plan"
  | "building"
  | "preparing"
  | "matches"
  | "agency"
  | "gallery"
  | "quotes"
  | "compare"
  | "trips"
  | "maps"
  | "recommendations";
const icons = {
  home: House,
  maps: Map,
  trips: Wallet,
  recommendations: ThumbsUp,
};

function Photo({
  name,
  alt,
  className = "",
}: {
  name: string;
  alt: string;
  className?: string;
}) {
  return <img src={`/images/${name}.webp`} alt={alt} className={className} />;
}
function Logo({ className = "" }: { className?: string }) {
  return (
    <Photo name="logo" alt="GiyaHero" className={`gh-logo ${className}`} />
  );
}
function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="gh-badge">
      <ShieldCheck size={13} />
      {children}
    </span>
  );
}

export function DemoTravelApp() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [history, setHistory] = useState<Screen[]>([]);
  const [search, setSearch] = useState("");
  const [destination, setDestination] = useState("");
  const [origin, setOrigin] = useState("Tayabas City");
  const [budget, setBudget] = useState("");
  const [adults, setAdults] = useState(5);
  const [children, setChildren] = useState(2);
  const [start, setStart] = useState("2026-10-11");
  const [end, setEnd] = useState("2026-10-13");
  const [error, setError] = useState("");
  const [active, setActive] = useState(packages[0]);
  const [selected, setSelected] = useState<string[]>([
    packages[0].id,
    packages[1].id,
  ]);
  const [saved, setSaved] = useState<string[]>([]);
  const [sort, setSort] = useState("match");
  const [tripTab, setTripTab] = useState("Saved");
  const [recommendationTab, setRecommendationTab] = useState("All");
  const [mapTab, setMapTab] = useState("Destinations");
  const [differences, setDifferences] = useState(false);
  const [notice, setNotice] = useState("");
  const [request, setRequest] = useState(false);
  const [requestDone, setRequestDone] = useState(false);
  const [filters, setFilters] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!request || !dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, [request]);
  useEffect(() => {
    if (screen !== "building" && screen !== "preparing") return;
    const timer = window.setTimeout(() => {
      setScreen(screen === "building" ? "matches" : "quotes");
      window.scrollTo(0, 0);
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [screen]);
  const travelers = adults + children;
  const matches = findPackages(destination, Number(budget));
  const comparisons = packages.filter((item) => selected.includes(item.id));

  function go(next: Screen) {
    setHistory((previous) => [...previous, screen]);
    setScreen(next);
    setNotice("");
    window.scrollTo(0, 0);
  }
  function back() {
    setScreen(history.at(-1) ?? "home");
    setHistory((previous) => previous.slice(0, -1));
    setNotice("");
    window.scrollTo(0, 0);
  }
  function toggleSaved(id: string) {
    setSaved((previous) =>
      previous.includes(id)
        ? previous.filter((value) => value !== id)
        : [...previous, id],
    );
  }
  function toggleComparison(id: string) {
    setSelected((previous) =>
      previous.includes(id)
        ? previous.filter((value) => value !== id)
        : [...previous, id],
    );
  }
  function openAgency(item: TravelPackage) {
    setActive(item);
    go("agency");
  }
  function plan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = validateTrip(start, end, travelers);
    setError(message);
    if (!message) go("building");
  }
  function title(text: string, extra?: ReactNode) {
    return (
      <header className="gh-page-heading">
        <button className="gh-round" onClick={back} aria-label="Go back">
          <ArrowLeft size={20} />
        </button>
        <h1>{text}</h1>
        {extra}
      </header>
    );
  }
  function packageCard(item: TravelPackage) {
    return (
      <article className="gh-package" key={item.id}>
        <button className="gh-package-main" onClick={() => openAgency(item)}>
          <Photo name={item.image} alt={item.name} />
          <span>
            <strong>{item.name}</strong>
            <small>
              {item.duration} · {item.destinations.slice(0, 2).join(", ")}
            </small>
            <span className="gh-package-agency">
              {item.agency} <ShieldCheck size={12} />
            </span>
          </span>
        </button>
        <div className="gh-package-actions">
          <strong>
            {peso(item.price)}
            <small>/ person</small>
          </strong>
          <button
            aria-label={`${saved.includes(item.id) ? "Unsave" : "Save"} ${item.name}`}
            onClick={() => toggleSaved(item.id)}
          >
            <Bookmark
              size={17}
              fill={saved.includes(item.id) ? "currentColor" : "none"}
            />
          </button>
        </div>
      </article>
    );
  }

  return (
    <main className="gh-shell">
      <div className={`gh-app ${screen === "welcome" ? "gh-app-welcome" : ""}`}>
        {screen === "welcome" ? (
          <section className="gh-welcome">
            <Photo
              name="welcome"
              alt="A colorful jeepney in front of Quezon's heritage buildings"
              className="gh-welcome-art"
            />
            <h1>
              Real agencies.
              <br />
              Real packages.
              <br />
              One trusted place.
            </h1>
            <p>
              Compare verified travel packages, get quotations side by side, and
              book with confidence—no more scattered searches.
            </p>
            <ul>
              {[
                [ShieldCheck, "Verified agencies only"],
                [Ticket, "Compare quotations instantly"],
                [Sparkles, "One request. A confirmed answer."],
              ].map(([Icon, text]) => {
                const ItemIcon = Icon as typeof ShieldCheck;
                return (
                  <li key={String(text)}>
                    <span>
                      <ItemIcon size={19} />
                    </span>
                    {String(text)}
                  </li>
                );
              })}
            </ul>
            <div className="gh-welcome-bottom">
              <div className="gh-dots">
                <span />
                <span />
                <span />
              </div>
              <button className="gh-primary" onClick={() => go("home")}>
                Get Started
              </button>
            </div>
          </section>
        ) : (
          <>
            <div className="gh-demo">
              <ShieldCheck size={12} /> Design preview · Sample packages and
              quotations
            </div>
            {screen === "home" && (
              <section className="gh-content">
                <header className="gh-home-heading">
                  <span className="gh-avatar">GH</span>
                  <div>
                    <small>Kumusta, Giyahero...</small>
                    <h1>Let’s find your next trip?</h1>
                  </div>
                  <button
                    className="gh-round"
                    aria-label="Notifications"
                    onClick={() =>
                      setNotice(
                        "You’re all caught up. Saved trips will appear in My Trips.",
                      )
                    }
                  >
                    <Bell size={23} />
                  </button>
                </header>
                <div className="gh-search">
                  <label>
                    <Search size={20} />
                    <input
                      aria-label="Search packages or agencies"
                      placeholder="Search packages or agencies"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </label>
                  <button
                    className="gh-filter"
                    aria-label="Filter packages"
                    onClick={() => setFilters(!filters)}
                  >
                    <SlidersHorizontal size={23} />
                  </button>
                </div>
                {filters && (
                  <div className="gh-filter-panel">
                    <label>
                      Maximum budget per person
                      <input
                        type="number"
                        min="0"
                        value={budget}
                        placeholder="Any budget"
                        onChange={(event) => setBudget(event.target.value)}
                      />
                    </label>
                    <button
                      className="gh-text-button"
                      onClick={() => {
                        setBudget("");
                        setFilters(false);
                      }}
                    >
                      Reset filters
                    </button>
                  </div>
                )}
                <div className="gh-hero">
                  <span className="gh-gabby-tag">
                    <Logo /> Ask Gabby
                  </span>
                  <h2>
                    Your travel attendant
                    <br />
                    in just a few taps
                  </h2>
                  <p>
                    Tell her your budget, dates, and interests—she’ll match you
                    to real packages from verified agencies.
                  </p>
                  <button className="gh-primary" onClick={() => go("plan")}>
                    Start Planning
                  </button>
                </div>
                <div className="gh-categories">
                  {(
                    [
                      ["All", Compass, "home"],
                      ["Map", Map, "maps"],
                      ["Trips", Wallet, "trips"],
                      ["Reviews", MessageSquare, "agency"],
                      ["Recommendations", ThumbsUp, "recommendations"],
                    ] as const
                  ).map(([label, Icon, target]) => (
                    <button
                      key={label}
                      className={label === "All" ? "active" : ""}
                      onClick={() => target !== "home" && go(target)}
                    >
                      <span>
                        <Icon size={27} />
                      </span>
                      {label}
                    </button>
                  ))}
                </div>
                {search || budget ? (
                  <>
                    <div className="gh-section-title">
                      <h2>Matching packages</h2>
                      <small>
                        {findPackages(search, Number(budget)).length} results
                      </small>
                    </div>
                    {findPackages(search, Number(budget)).map(packageCard)}
                    {!findPackages(search, Number(budget)).length && (
                      <p className="gh-empty">
                        No packages match. Try another destination or budget.
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <div className="gh-section-title">
                      <h2>Agency Spotlights</h2>
                      <button onClick={() => go("matches")}>See all</button>
                    </div>
                    <div className="gh-spotlights">
                      {[packages[1], packages[2], packages[0]].map((item) => (
                        <button key={item.id} onClick={() => openAgency(item)}>
                          <Photo name={item.image} alt={item.agency} />
                          <span className="gh-spotlight-label">
                            <ShieldCheck size={14} />
                            {item.agency}
                          </span>
                          <strong>
                            {item.destinations[0]}
                            <small>Discover with local experts</small>
                          </strong>
                        </button>
                      ))}
                    </div>
                    <div className="gh-section-title">
                      <h2>Explore Quezon</h2>
                      <button onClick={() => go("recommendations")}>
                        See more
                      </button>
                    </div>
                    {packages.slice(0, 2).map(packageCard)}
                  </>
                )}
              </section>
            )}
            {screen === "plan" && (
              <section className="gh-content">
                {title(
                  "Plan your Trip",
                  <span className="gh-tag">Trip details</span>,
                )}
                <div className="gh-info">
                  <Info size={19} />
                  <p>
                    Tell us once, then{" "}
                    <strong>browse matching packages yourself</strong> or let{" "}
                    <strong>Gabby</strong> fit your trip.
                  </p>
                </div>
                <form className="gh-plan" onSubmit={plan}>
                  <div className="gh-section-title">
                    <h2>Preferred dates</h2>
                    <small>Flexible by 2 days</small>
                  </div>
                  <div className="gh-date-row">
                    <label>
                      Departure
                      <input
                        aria-label="Departure date"
                        type="date"
                        value={start}
                        onChange={(event) => setStart(event.target.value)}
                        required
                      />
                    </label>
                    <label>
                      Return
                      <input
                        aria-label="Return date"
                        type="date"
                        value={end}
                        onChange={(event) => setEnd(event.target.value)}
                        required
                      />
                    </label>
                  </div>
                  <h2>Group size</h2>
                  <div className="gh-group">
                    {(
                      [
                        ["Adults", "Ages 13 and up", adults, setAdults],
                        ["Children", "Ages 3 to 12", children, setChildren],
                      ] as const
                    ).map(([label, description, count, setter]) => (
                      <div key={label}>
                        <span>
                          <strong>{label}</strong>
                          <small>{description}</small>
                        </span>
                        <button
                          type="button"
                          aria-label={`Remove ${label.toLowerCase()}`}
                          disabled={count === (label === "Adults" ? 1 : 0)}
                          onClick={() =>
                            setter(
                              Math.max(label === "Adults" ? 1 : 0, count - 1),
                            )
                          }
                        >
                          <Minus size={18} />
                        </button>
                        <b aria-live="polite">{count}</b>
                        <button
                          type="button"
                          aria-label={`Add ${label.toLowerCase()}`}
                          disabled={count >= 20}
                          onClick={() => setter(count + 1)}
                        >
                          <Plus size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <label htmlFor="trip-origin">Starting from</label>
                  <select
                    id="trip-origin"
                    value={origin}
                    onChange={(event) => setOrigin(event.target.value)}
                  >
                    <option>Tayabas City</option>
                    <option>Lucena City</option>
                    <option>Manila</option>
                    <option>Mauban</option>
                  </select>
                  <label htmlFor="trip-destination">Destination</label>
                  <select
                    id="trip-destination"
                    value={destination}
                    onChange={(event) => setDestination(event.target.value)}
                  >
                    <option value="">Explore all of Quezon</option>
                    {[
                      "Lucban",
                      "Tayabas",
                      "Mauban",
                      "Cagbalete Island",
                      "Guinayangan",
                    ].map((place) => (
                      <option key={place}>{place}</option>
                    ))}
                  </select>
                  <label>
                    Budget per person <small>(Optional)</small>
                    <input
                      type="number"
                      min="0"
                      placeholder="Amount"
                      value={budget}
                      onChange={(event) => setBudget(event.target.value)}
                    />
                  </label>
                  {error && (
                    <p className="gh-error" role="alert">
                      {error}
                    </p>
                  )}
                  <button className="gh-primary" type="submit">
                    See Gabby’s picks
                  </button>
                </form>
              </section>
            )}
            {(screen === "building" || screen === "preparing") && (
              <section className="gh-content gh-progress-screen">
                {title(
                  screen === "building" ? "Gabby" : "Getting your quotations",
                )}
                <Logo className="gh-progress-logo" />
                <h2>
                  {screen === "building"
                    ? "Building your itinerary"
                    : "Preparing your quotations"}
                </h2>
                <p className="gh-muted">
                  Matching the sample packages to your trip details.
                </p>
                <div
                  className="gh-progress-card"
                  role="status"
                  aria-live="polite"
                >
                  <p>
                    <CheckCircle2 size={19} />
                    <span>
                      <strong>Read your trip details</strong>
                      <small>
                        {travelers} travelers · From {origin}
                      </small>
                    </span>
                  </p>
                  <p>
                    <CheckCircle2 size={19} />
                    <span>
                      <strong>Selected sample agencies</strong>
                      <small>Based on the approved design</small>
                    </span>
                  </p>
                  <p>
                    <Clock3 size={19} />
                    <span>
                      <strong>
                        {screen === "building"
                          ? "Matching packages to your interests"
                          : "Calculating sample group quotations"}
                      </strong>
                      <small>Budget, destinations and travel dates</small>
                    </span>
                  </p>
                </div>
                <div className="gh-skeleton" />
                <div className="gh-skeleton" />
              </section>
            )}
            {screen === "matches" && (
              <section className="gh-content">
                {title("Gabby", <Logo />)}
                <div className="gh-matches-heading">
                  <Badge>Matching sample packages</Badge>
                  <p>
                    Packages that fit your dates, group, and budget.
                    <br />
                    Sample inventory for this design preview.
                  </p>
                </div>
                <div className="gh-info">
                  <Users size={17} />
                  <p>
                    {travelers} travelers · {destination || "Quezon Province"} ·
                    From {origin}
                  </p>
                </div>
                {matches.map(packageCard)}
                {!matches.length && (
                  <div className="gh-empty">
                    <h2>No packages within this budget</h2>
                    <p>
                      Try increasing your budget or choosing another
                      destination.
                    </p>
                    <button className="gh-primary" onClick={back}>
                      Adjust trip details
                    </button>
                  </div>
                )}
                {matches.length > 0 && (
                  <div className="gh-bottom-actions">
                    <button
                      className="gh-primary"
                      onClick={() => {
                        setSelected(matches.slice(0, 3).map((item) => item.id));
                        go("preparing");
                      }}
                    >
                      Get sample quotations
                    </button>
                    <button
                      className="gh-secondary"
                      onClick={() => {
                        setSelected(matches.slice(0, 2).map((item) => item.id));
                        go("compare");
                      }}
                    >
                      Compare packages
                    </button>
                  </div>
                )}
              </section>
            )}
            {screen === "agency" && (
              <section className="gh-agency">
                <div className="gh-agency-cover">
                  <Photo
                    name={active.image}
                    alt={`${active.agency} destination`}
                  />
                  <button
                    className="gh-round"
                    onClick={back}
                    aria-label="Go back"
                  >
                    <ArrowLeft size={20} />
                  </button>
                </div>
                <div className="gh-content">
                  <span className="gh-agency-initials">
                    {active.agency
                      .split(" ")
                      .slice(0, 2)
                      .map((word) => word[0])
                      .join("")}
                  </span>
                  <h1>{active.agency}</h1>
                  <p className="gh-location">
                    <MapPin size={15} />
                    Tayabas City, Quezon <Star size={15} className="gh-star" />
                    4.8 <span>(212 sample reviews)</span>
                  </p>
                  <div className="gh-verification">
                    <div>
                      <ShieldCheck size={24} />
                      <span>
                        <strong>Verified agency</strong>
                        <small>
                          Verification badge as shown in the approved design.
                          Preview data.
                        </small>
                      </span>
                    </div>
                    {[
                      ["Business Registration", "Matched to DTI record"],
                      [
                        "DOT Accreditation",
                        "Accreditation details provided by agency",
                      ],
                      ["Business Permits", "Mayor’s permit, Tayabas"],
                    ].map(([label, sub]) => (
                      <article key={label}>
                        <Check size={18} />
                        <span>
                          <strong>{label}</strong>
                          <small>{sub}</small>
                        </span>
                        <Badge>Verified</Badge>
                      </article>
                    ))}
                  </div>
                  <div className="gh-stats">
                    {[
                      ["1420", "travelers hosted"],
                      ["3", "active packages"],
                      ["2 hrs", "average reply time"],
                    ].map(([value, label]) => (
                      <div key={label}>
                        <strong>{value}</strong>
                        <small>{label}</small>
                      </div>
                    ))}
                  </div>
                  <h2>About Us</h2>
                  <p className="gh-muted">
                    Family-run since 2014 in Tayabas. We design heritage, food
                    and island loops across Quezon. Always with a local guide
                    who grew up on the route.
                  </p>
                  <div className="gh-section-title">
                    <h2>Gallery</h2>
                    <button onClick={() => go("gallery")}>View all</button>
                  </div>
                  <div className="gh-gallery-strip">
                    {["bay", "river", "lucban"].map((name) => (
                      <button key={name} onClick={() => go("gallery")}>
                        <Photo name={name} alt={`Quezon ${name} destination`} />
                      </button>
                    ))}
                  </div>
                  <h2>Packages by this agency</h2>
                  {packages
                    .filter((item) => item.agency === active.agency)
                    .map(packageCard)}
                  <div className="gh-section-title">
                    <h2>Verified traveler reviews</h2>
                    <span className="gh-tag">Sample reviews</span>
                  </div>
                  {[
                    [
                      "Rosa Garcia",
                      "The trip matched the listing exactly. Warm local guides and a beautiful island stay.",
                    ],
                    [
                      "Terrence Noga",
                      "Booked for our family. The itinerary was well paced, with time to explore.",
                    ],
                  ].map(([name, text]) => (
                    <article className="gh-review" key={name}>
                      <strong>{name}</strong>
                      <span className="gh-review-rating">
                        <Star size={14} fill="currentColor" /> 5.0
                      </span>
                      <p>{text}</p>
                      <Badge>Verified trip</Badge>
                    </article>
                  ))}
                  <div className="gh-bottom-actions">
                    <button
                      className="gh-secondary"
                      onClick={() =>
                        setNotice(
                          "Messaging is not connected in this preview. You can explore sample quotations instead.",
                        )
                      }
                    >
                      <MessageSquare size={17} />
                      Message
                    </button>
                    <button
                      className="gh-primary"
                      onClick={() => {
                        setSelected([active.id]);
                        go("quotes");
                      }}
                    >
                      Get quotation
                    </button>
                  </div>
                </div>
              </section>
            )}
            {screen === "gallery" && (
              <section className="gh-content">
                {title("Gallery")}
                <h2 className="gh-centered">Our Highlights</h2>
                <Photo
                  name="bay"
                  alt="A scenic Quezon bay"
                  className="gh-gallery-hero"
                />
                <div className="gh-dots">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="gh-photo-grid">
                  {["river", "tayabas", "lucban", "mauban", "beach", "bay"].map(
                    (name) => (
                      <Photo
                        key={name}
                        name={name}
                        alt={`${name} destination in Quezon`}
                      />
                    ),
                  )}
                </div>
                <button
                  className="gh-primary"
                  onClick={() => {
                    setSelected([active.id]);
                    go("quotes");
                  }}
                >
                  Get quotation
                </button>
              </section>
            )}
            {screen === "quotes" && (
              <section className="gh-content">
                {title("Your quotations")}
                <p className="gh-muted">
                  {start} to {end} · {travelers} travelers
                </p>
                <div className="gh-tabs">
                  {[
                    ["match", "Best Match"],
                    ["price", "Lowest Price"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      className={sort === value ? "active" : ""}
                      onClick={() => setSort(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="gh-warning">
                  <Clock3 size={19} />
                  <p>
                    Illustrative quotations. Prices and availability need agency
                    confirmation.
                  </p>
                </div>
                {[...matches]
                  .sort((a, b) =>
                    sort === "price" ? a.price - b.price : b.match - a.match,
                  )
                  .map((item, index) => (
                    <article
                      className={`gh-quote ${index === 0 ? "best" : ""}`}
                      key={item.id}
                    >
                      <span className="gh-tag">
                        {index === 0 ? "Best Match" : "Great Fit"} {item.match}%
                      </span>
                      <h2>{item.name}</h2>
                      <button
                        className="gh-text-button"
                        onClick={() => openAgency(item)}
                      >
                        <ShieldCheck size={15} />
                        {item.agency}
                      </button>
                      <p>
                        Quotation Total
                        <strong className="gh-total">
                          {peso(quoteTotal(item, adults, children))}
                        </strong>
                      </p>
                      <div className="gh-quote-facts">
                        <span>
                          Duration<strong>{item.duration}</strong>
                        </span>
                        <span>
                          No. of Pax<strong>{travelers} travelers</strong>
                        </span>
                        <span>
                          Deposit
                          <strong>
                            {peso(
                              Math.round(
                                quoteTotal(item, adults, children) * 0.3,
                              ),
                            )}
                          </strong>
                        </span>
                      </div>
                      <h3>Inclusions:</h3>
                      <ul>
                        <li>Hotel accommodation and daily breakfast</li>
                        <li>{item.transport}</li>
                        <li>Guided local tours and entrance fees</li>
                        <li>Agency assistance throughout your trip</li>
                      </ul>
                      <div className="gh-bottom-actions">
                        <button
                          className="gh-secondary"
                          aria-pressed={selected.includes(item.id)}
                          onClick={() => toggleComparison(item.id)}
                        >
                          {selected.includes(item.id) && <Check size={16} />}
                          Compare
                        </button>
                        <button
                          className="gh-primary"
                          onClick={() => {
                            setActive(item);
                            setRequestDone(false);
                            setRequest(true);
                          }}
                        >
                          View quotation
                        </button>
                      </div>
                    </article>
                  ))}
                <button
                  className="gh-compare-bar"
                  disabled={!selected.length}
                  onClick={() => go("compare")}
                >
                  <strong>
                    {selected.length} quotation
                    {selected.length !== 1 ? "s" : ""} selected
                  </strong>
                  <span>
                    Compare price, stops and inclusions{" "}
                    <ChevronRight size={18} />
                  </span>
                </button>
              </section>
            )}
            {screen === "compare" && (
              <section className="gh-comparison">
                {title(
                  "Compare quotations",
                  <button
                    className="gh-text-button"
                    onClick={() => setSelected([])}
                  >
                    Clear
                  </button>,
                )}
                <div className="gh-comparison-options">
                  <small>
                    {travelers} travelers · {start} to {end}
                  </small>
                  <label>
                    Show differences
                    <input
                      type="checkbox"
                      checked={differences}
                      onChange={(event) => setDifferences(event.target.checked)}
                    />
                  </label>
                </div>
                {comparisons.length ? (
                  <>
                    <div className="gh-table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Packages</th>
                            {comparisons.map((item) => (
                              <th key={item.id}>
                                <Photo name={item.image} alt={item.name} />
                                <span className="gh-tag">
                                  {item.match}% match
                                </span>
                                <strong>{item.name}</strong>
                                <small>{item.agency}</small>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(
                            [
                              [
                                "Price per person",
                                (item: TravelPackage) => peso(item.price),
                              ],
                              [
                                "Quote total",
                                (item: TravelPackage) =>
                                  peso(quoteTotal(item, adults, children)),
                              ],
                              [
                                "Deposit (30%)",
                                (item: TravelPackage) =>
                                  peso(
                                    Math.round(
                                      quoteTotal(item, adults, children) * 0.3,
                                    ),
                                  ),
                              ],
                              [
                                "Duration",
                                (item: TravelPackage) => item.duration,
                              ],
                              [
                                "Destinations",
                                (item: TravelPackage) =>
                                  item.destinations.join(", "),
                              ],
                              [
                                "Transport",
                                (item: TravelPackage) => item.transport,
                              ],
                            ] as const
                          )
                            .filter(
                              ([, value]) =>
                                !differences ||
                                new Set(comparisons.map(value)).size > 1,
                            )
                            .map(([label, value]) => (
                              <tr key={label}>
                                <th scope="row">{label}</th>
                                {comparisons.map((item) => (
                                  <td
                                    key={item.id}
                                    className={
                                      label === "Quote total" ? "gh-price" : ""
                                    }
                                  >
                                    {value(item)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="gh-content gh-bottom-actions">
                      <button
                        className="gh-secondary"
                        onClick={() => go("quotes")}
                      >
                        Open quotations
                      </button>
                      <button
                        className="gh-primary"
                        onClick={() => {
                          setActive(comparisons[0]);
                          setRequestDone(false);
                          setRequest(true);
                        }}
                      >
                        Send request
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="gh-content gh-empty">
                    <p>Select packages to compare quotations.</p>
                    <button className="gh-primary" onClick={() => go("quotes")}>
                      Choose packages
                    </button>
                  </div>
                )}
              </section>
            )}
            {screen === "trips" && (
              <section className="gh-content">
                {title("My Trips")}
                <div className="gh-tabs">
                  {["Saved", "Upcoming", "Past"].map((tab) => (
                    <button
                      key={tab}
                      className={tripTab === tab ? "active" : ""}
                      onClick={() => setTripTab(tab)}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                {tripTab === "Saved" &&
                  packages
                    .filter((item) => saved.includes(item.id))
                    .map(packageCard)}
                {(tripTab !== "Saved" || !saved.length) && (
                  <div className="gh-empty">
                    <Bookmark size={36} />
                    <h2>
                      {tripTab === "Saved"
                        ? "Your next adventure starts here"
                        : `No ${tripTab.toLowerCase()} trips yet`}
                    </h2>
                    <p>
                      {tripTab === "Saved"
                        ? "Save a package to keep it here while you plan."
                        : "This preview does not create bookings."}
                    </p>
                    <button
                      className="gh-primary"
                      onClick={() => go("matches")}
                    >
                      Explore packages
                    </button>
                  </div>
                )}
              </section>
            )}
            {screen === "maps" && (
              <section className="gh-content">
                {title("Explore Quezon")}
                <figure className="gh-map-preview">
                  <Photo
                    name="quezon-map"
                    alt="Static map from the approved design showing Cagbalete Island, Silangang Nayon, and Malagonlong Bridge"
                  />
                  <figcaption>
                    Reference map · Live navigation is not connected
                  </figcaption>
                </figure>
                <div className="gh-tabs">
                  {["Destinations", "Agencies", "Food", "Heritage"].map(
                    (tab) => (
                      <button
                        key={tab}
                        className={mapTab === tab ? "active" : ""}
                        onClick={() => setMapTab(tab)}
                      >
                        {tab}
                      </button>
                    ),
                  )}
                </div>
                <div className="gh-info">
                  <Map size={19} />
                  <p>
                    The live map isn’t connected yet. Explore the places shown
                    in the approved design below.
                  </p>
                </div>
                {(mapTab === "Agencies"
                  ? packages
                  : mapTab === "Food" || mapTab === "Heritage"
                    ? [packages[2]]
                    : packages
                ).map((item) => (
                  <button
                    className="gh-place"
                    key={item.id}
                    onClick={() => {
                      setDestination(item.destinations[0]);
                      openAgency(item);
                    }}
                  >
                    <Photo
                      name={mapTab === "Heritage" ? "tayabas" : item.image}
                      alt={item.destinations[0]}
                    />
                    <span>
                      <span className="gh-tag">{mapTab}</span>
                      <h2>
                        {mapTab === "Agencies"
                          ? item.agency
                          : mapTab === "Heritage"
                            ? "Malagonlong Bridge"
                            : mapTab === "Food"
                              ? "Lucban local flavors"
                              : item.destinations[0]}
                      </h2>
                      <p>
                        <MapPin size={14} />
                        Quezon Province
                      </p>
                      <strong>
                        See packages <ChevronRight size={15} />
                      </strong>
                    </span>
                  </button>
                ))}
              </section>
            )}
            {screen === "recommendations" && (
              <section className="gh-content">
                {title("Recommendations")}
                <div className="gh-tabs">
                  {["All", "Food", "Heritage", "Local products"].map((tab) => (
                    <button
                      key={tab}
                      className={recommendationTab === tab ? "active" : ""}
                      onClick={() => setRecommendationTab(tab)}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <button
                  className="gh-feature"
                  onClick={() => openAgency(packages[2])}
                >
                  <Photo
                    name={
                      recommendationTab === "Heritage" ? "tayabas" : "lucban"
                    }
                    alt="Lucban and Tayabas heritage"
                  />
                  <span>
                    <span className="gh-tag">
                      {recommendationTab === "All"
                        ? "Festival"
                        : recommendationTab}
                    </span>
                    <h2>
                      {recommendationTab === "Food"
                        ? "Discover Lucban’s local flavors"
                        : recommendationTab === "Local products"
                          ? "Bring a little Quezon home"
                          : recommendationTab === "Heritage"
                            ? "Walk through Quezon’s history"
                            : "Lucban in celebration"}
                    </h2>
                    <p>Explore with a verified local agency</p>
                  </span>
                </button>
                <h2>See packages</h2>
                {(recommendationTab === "All" ? packages : [packages[2]]).map(
                  packageCard,
                )}
              </section>
            )}
            {notice && (
              <div className="gh-notice" role="status">
                <Info size={17} />
                <p>{notice}</p>
                <button
                  aria-label="Dismiss notification"
                  onClick={() => setNotice("")}
                >
                  <X size={17} />
                </button>
              </div>
            )}
            <nav className="gh-nav" aria-label="Main navigation">
              {(["home", "recommendations"] as const).map((target) => {
                const Icon = icons[target];
                return (
                  <button
                    key={target}
                    className={screen === target ? "active" : ""}
                    onClick={() => go(target)}
                  >
                    <Icon size={23} />
                    <span>{target === "home" ? "Home" : "Discover"}</span>
                  </button>
                );
              })}
              <button
                className="gh-gabby"
                aria-label="Plan with Gabby"
                onClick={() => go("plan")}
              >
                <Logo />
              </button>
              {(["maps", "trips"] as const).map((target) => {
                const Icon = icons[target];
                return (
                  <button
                    key={target}
                    className={screen === target ? "active" : ""}
                    onClick={() => go(target)}
                  >
                    <Icon size={23} />
                    <span>{target === "maps" ? "Maps" : "Trips"}</span>
                  </button>
                );
              })}
            </nav>
          </>
        )}
        {request && (
          <div className="gh-modal-backdrop">
            <dialog
              ref={dialogRef}
              className="gh-modal"
              aria-labelledby="request-title"
              onCancel={() => setRequest(false)}
            >
              <button
                className="gh-round gh-close"
                aria-label="Close quotation"
                onClick={() => setRequest(false)}
              >
                <X size={20} />
              </button>
              {requestDone ? (
                <>
                  <CheckCircle2 size={48} className="gh-success-icon" />
                  <h2 id="request-title">Added to your saved trips</h2>
                  <p>
                    This was a preview request. No request has been sent to the
                    agency and no booking has been made.
                  </p>
                  <button
                    className="gh-primary"
                    autoFocus
                    onClick={() => {
                      setRequest(false);
                      go("trips");
                    }}
                  >
                    View My Trips
                  </button>
                </>
              ) : (
                <>
                  <span className="gh-tag">Sample quotation</span>
                  <h2 id="request-title">{active.name}</h2>
                  <p>{active.agency}</p>
                  <strong className="gh-total">
                    {peso(quoteTotal(active, adults, children))}
                  </strong>
                  <p>
                    {travelers} travelers · {active.duration}
                  </p>
                  <div className="gh-info">
                    <Info size={18} />
                    <p>
                      This preview demonstrates the request flow. Agency
                      messaging, live availability, and booking are not
                      connected.
                    </p>
                  </div>
                  <button
                    className="gh-primary"
                    autoFocus
                    onClick={() => {
                      setSaved((previous) =>
                        previous.includes(active.id)
                          ? previous
                          : [...previous, active.id],
                      );
                      setRequestDone(true);
                    }}
                  >
                    Save preview request
                  </button>
                </>
              )}
            </dialog>
          </div>
        )}
      </div>
    </main>
  );
}
