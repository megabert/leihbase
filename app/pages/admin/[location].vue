<template>
  <Container width="lg" centered>
    <PageAlert class="banner" />
    <header class="page-header">
      <div>
        <h1 class="h2">{{ location?.name }}</h1>
        <h2 class="h1">{{ t("title") }}</h2>
      </div>
      <Button @click="handleNewReservationClick">{{
        t("new_reservation")
      }}</Button>
    </header>

    <TabList active="today" class="tablist">
      <Tab id="today" :title="t('tab_shift')">
        <section class="today">
          <header>
            <button @click="handleDayBackward">
              <ArrowLeft class="icon" />
            </button>
            <h3>
              {{
                isToday(date)
                  ? t("Today")
                  : formatDate(date, "ddd, DD.MM", locale)
              }}
            </h3>
            <button @click="handleDayForward">
              <ArrowRight class="icon" />
            </button>
          </header>
          <AdminReservationTable
            v-if="todaysReservations && todaysReservations.length > 0"
            :reservations="todaysReservations"
            :date="date"
            highlight-date="date"
            @select="handleReservationSelect"
          />
          <p v-else>
            <i>
              {{
                t("no_reservations_on_date", {
                  date: isToday(date)
                    ? t("today")
                    : t("on") + " " + formatDate(date, "DD.MM", locale),
                })
              }}.
            </i>
          </p>
        </section>
      </Tab>

      <Tab id="ongoing" :title="t('tab_ongoing')">
        <section>
          <h3>{{ t("ongoing_title") }}</h3>
          <AdminReservationTable
            v-if="ongoingReservations && ongoingReservations.length > 0"
            :reservations="ongoingReservations"
            highlight-date="end"
            @select="handleReservationSelect"
          />
          <p v-else>
            <i>
              {{ t("no_ongoing_reservations") }}
            </i>
          </p>
        </section>
      </Tab>

      <Tab id="future" :title="t('tab_future')">
        <section>
          <h3>{{ t("future_title") }}</h3>
          <AdminReservationTable
            v-if="futureReservations && futureReservations.length > 0"
            :reservations="futureReservations"
            highlight-date="start"
            @select="handleReservationSelect"
          />
          <p v-else>
            <i>
              {{ t("no_future_reservations") }}
            </i>
          </p>
        </section>
      </Tab>

      <Tab id="past" :title="t('tab_past')">
        <section>
          <h3>{{ t("past_title") }}</h3>
          <AdminReservationTable
            v-if="pastReservations?.items && pastReservations.items.length > 0"
            :reservations="pastReservations.items"
            highlight-date="both"
            @select="handleReservationSelect"
          />
          <p v-else>
            <i>
              {{ t("no_past_reservations") }}
            </i>
          </p>
        </section>
      </Tab>
    </TabList>
  </Container>
  <ReservationDrawer
    v-model:open="reservationDrawerOpen"
    :state="selectedReservation ? 'edit' : 'new'"
    :location="location"
    :reservation="selectedReservation"
    @update="handleReservationUpdate"
  />
  <RecordPicker ref="recordPicker" />
</template>

<script lang="ts" setup>
import AdminReservationTable from "~/components/admin/AdminReservationsTable.vue";
import RecordPicker from "~/components/admin/RecordPicker.vue";
import ReservationDrawer from "./components/ReservationDrawer.vue";
import { isToday, startOfUTCDate, endOfUTCDate, formatDate } from "~/lib/date";
import { ArrowRight, ArrowLeft } from "@iconoir/vue";
import type { Reservation } from "~/models/reservation";
import type { ListResult } from "pocketbase";

const { pb } = usePocketbase();
const route = useRoute();
const { locale } = useI18n();
const { t } = useI18n({
  useScope: "local",
});

const slug = route.params.location;

const date = ref(new Date(Date.now()));
const reservationDrawerOpen = ref(false);
const selectedReservation = ref<Reservation | null>(null);

const recordPicker = ref(null);
provide("recordPicker", recordPicker);

const { data: location } = await useAsyncData("admin_location", async () => {
  const location = await pb
    .collection("location")
    .getFirstListItem(pb.filter("slug = {:slug}", { slug }));
  return structuredClone(location);
});

if (!location.value || !location.value.id) {
  throw createError({
    statusCode: 404,
    statusMessage: "Page Not Found",
  });
}

const { data: todaysReservations, refresh: refreshTodaysReservations } =
  await useAsyncData("admin_todays_reservations", async () => {
    const reservations = await pb.collection("reservations").getFullList({
      filter: pb.filter(
        "location = {:location} && ((start >= {:dateStart} && start <= {:dateEnd}) || (end >= {:dateStart} && end <= {:dateEnd}))",
        {
          location: location.value?.id,
          dateStart: startOfUTCDate(date.value),
          dateEnd: endOfUTCDate(date.value),
        }
      ),
      sort: "start",
      expand: "product,user",
      requestKey: "admin_todays_reservations",
    });
    return structuredClone(reservations) as Reservation[];
  });

const { data: ongoingReservations, refresh: refreshOngoingReservations } =
  await useAsyncData("admin_ongoing_reservations", async () => {
    const reservations = await pb.collection("reservations").getFullList({
      filter: pb.filter(
        "location = {:location} && start < @todayStart && end > @todayEnd",
        {
          location: location.value?.id,
        }
      ),
      sort: "end",
      expand: "product,user",
      requestKey: "admin_ongoing_reservations",
    });
    return structuredClone(reservations) as Reservation[];
  });

const { data: futureReservations, refresh: refreshFutureReservations } =
  await useAsyncData("admin_future_reservations", async () => {
    const reservations = await pb.collection("reservations").getFullList({
      filter: pb.filter("location = {:location} && start > @todayEnd", {
        location: location.value?.id,
      }),
      sort: "start",
      expand: "product,user",
      requestKey: "admin_future_reservations",
    });
    return structuredClone(reservations) as Reservation[];
  });

const { data: pastReservations, refresh: refreshPastReservations } =
  await useAsyncData("admin_past_reservations", async () => {
    const reservations = await pb.collection("reservations").getList(0, 50, {
      filter: pb.filter("location = {:location} && end < @todayStart", {
        location: location.value?.id,
      }),
      sort: "-end",
      expand: "product,user",
      requestKey: "admin_past_reservations",
    });
    return structuredClone(reservations) as ListResult<Reservation>;
  });

function handleDayBackward() {
  date.value.setDate(date.value.getDate() - 1);
  refreshTodaysReservations();
}
function handleDayForward() {
  date.value.setDate(date.value.getDate() + 1);
  refreshTodaysReservations();
}

function handleReservationUpdate() {
  refreshTodaysReservations();
  refreshOngoingReservations();
  refreshFutureReservations();
  refreshPastReservations();
}

function handleReservationSelect(reservation: Reservation) {
  selectedReservation.value = reservation;
  reservationDrawerOpen.value = true;
}

function handleNewReservationClick() {
  selectedReservation.value = null;
  reservationDrawerOpen.value = true;
}
</script>

<style lang="scss" scoped>
@import "~/assets/styles/breakpoints.scss";

header.page-header {
  margin-bottom: var(--fluid-spacing-12);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  h1,
  h2 {
    margin: 0;
  }
  @media screen and (min-width: $breakpoint-sm) {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}
section {
  padding-top: 2rem;
}
section > header {
  display: flex;
  margin-bottom: 1rem;
  gap: var(--fluid-spacing-8);
  & > h3 {
    margin: 0;
  }
  & > button {
    background-color: transparent;
    border: 0;
    padding: 0;
    cursor: pointer;
    .icon {
      width: 1em;
      height: 1em;
    }
  }
}
section.today {
  h3 {
    min-width: 10rem;
    text-align: center;
  }
}
.date-field {
  display: none;
}
@media screen and (max-width: $breakpoint-sm) {
  .tablist :deep(ul.tablist) {
    --spacing-start: var(--fluid-spacing-8);
    --spacing-end: var(--fluid-spacing-8);
    margin-inline: calc(var(--fluid-spacing-8) * -1);
  }
}
</style>

<i18n lang="json">
{
  "en": {
    "title": "Reservations",
    "new_reservation": "New reservation",
    "tab_past": "Past",
    "tab_shift": "Today",
    "tab_ongoing": "Ongoing",
    "tab_future": "Future",
    "today": "heute",
    "Today": "Heute",
    "no_reservations_on_date": "No reservations starting or ending {date}",
    "no_ongoing_reservations": "There are no ongoing reservations.",
    "no_future_reservations": "There are no future reservations.",
    "on": "am",
    "ongoing_title": "Ongoing reservations",
    "future_title": "Future reservations",
    "past_title": "Past Reservations (last 50)"
  },
  "de": {
    "title": "Reservierungen",
    "new_reservation": "Neue Reservierung",
    "tab_past": "Vergangene",
    "tab_shift": "Heutige",
    "tab_ongoing": "Laufende",
    "tab_future": "Anstehende",
    "today": "heute",
    "Today": "Heute",
    "no_reservations_on_date": "Es gibt keine Reservierungen, die {date} starten oder enden",
    "no_ongoing_reservations": "Es gibt keine laufende Reservierungen.",
    "no_future_reservations": "Es gibt keine zukünftige Reservierungen.",
    "on": "am",
    "ongoing_title": "Laufende Reservierungen",
    "future_title": "Anstehende Reservierungen",
    "past_title": "Vergangene Reservierungen (letzte 50)"
  }
}
</i18n>
