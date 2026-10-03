from sqlalchemy import select
from sqlalchemy.orm import Session

from twin.models import HealthSnapshot


class HealthSnapshotRepository:

    def save(
        self,
        session: Session,
        snapshot: HealthSnapshot,
    ) -> HealthSnapshot:
        session.add(snapshot)
        session.flush()

        return snapshot

    def get_by_engine(
        self,
        session: Session,
        engine_id: str,
    ) -> list[HealthSnapshot]:
        statement = (
            select(HealthSnapshot)
            .where(HealthSnapshot.engine_id == engine_id)
            .order_by(HealthSnapshot.time)
        )

        return list(session.scalars(statement))

    def get_recent(
        self,
        session: Session,
        engine_id: str,
        mission_id: str,
        limit: int,
    ) -> list[HealthSnapshot]:
        """The latest `limit` snapshots of one mission, oldest first."""

        statement = (
            select(HealthSnapshot)
            .where(
                HealthSnapshot.engine_id == engine_id,
                HealthSnapshot.mission_id == mission_id,
            )
            .order_by(HealthSnapshot.time.desc())
            .limit(limit)
        )

        return list(reversed(list(session.scalars(statement))))

    def get_latest(
        self,
        session: Session,
        engine_id: str,
        mission_id: str,
    ) -> HealthSnapshot | None:
        recent = self.get_recent(session, engine_id, mission_id, 1)
        return recent[0] if recent else None

    def get_by_mission(
        self,
        session: Session,
        engine_id: str,
        mission_id: str,
    ) -> list[HealthSnapshot]:
        """All snapshots of one mission, oldest first."""

        statement = (
            select(HealthSnapshot)
            .where(
                HealthSnapshot.engine_id == engine_id,
                HealthSnapshot.mission_id == mission_id,
            )
            .order_by(HealthSnapshot.time)
        )

        return list(session.scalars(statement))
