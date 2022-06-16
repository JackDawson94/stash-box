import { FC, useContext } from "react";
import { Link, useHistory } from "react-router-dom";
import { Button, Card, Table } from "react-bootstrap";
import { faCheckCircle } from "@fortawesome/free-solid-svg-icons";

import {
  Scene_findScene as Scene,
  Scene_findScene_fingerprints as Fingerprint,
} from "src/graphql/definitions/Scene";
import { usePendingEditsCount, TargetTypeEnum, OperationEnum } from "src/graphql";
import AuthContext from "src/AuthContext";
import {
  canEdit,
  tagHref,
  performerHref,
  studioHref,
  createHref,
  formatDuration,
  formatDateTime,
  formatPendingEdits,
  getUrlBySite,
  compareByName,
} from "src/utils";
import {
  ROUTE_SCENE_EDIT,
  ROUTE_SCENES,
  ROUTE_SCENE_DELETE,
} from "src/constants/route";
import {
  GenderIcon,
  TagLink,
  PerformerName,
  Icon,
} from "src/components/fragments";
import { EditList, URLList } from "src/components/list";
import Image from "src/components/image";

const DEFAULT_TAB = "description";

interface Props {
  scene: Scene;
}

const SceneCard: FC<Props> = ({ scene }) => {
  if (!scene) {
    return null;
  }

  const { data: editData } = usePendingEditsCount({
    type: TargetTypeEnum.SCENE,
    id: scene.id,
    operation: OperationEnum.DESTROY
  });
  const pendingEditCount = editData?.queryEdits.count;

  const performers = scene.performers
    .map((performance) => {
      const { performer } = performance;
      return (
        <Link
          key={performer.id}
          to={performerHref(performer)}
          className="scene-performer"
        >
          <GenderIcon gender={performer.gender} />
          <PerformerName performer={performer} as={performance.as} />
        </Link>
      );
    })
    .map((p, index) => (index % 2 === 2 ? [" • ", p] : p));

  function maybeRenderSubmitted(fingerprint: Fingerprint) {
    if (fingerprint.user_submitted) {
      return (
        <span className="user-submitted" title="Submitted by you">
          <Icon icon={faCheckCircle} />
        </span>
      );
    }
  }

  const tags = [...scene.tags].sort(compareByName).map((tag) => (
    <li key={tag.name}>
      <TagLink title={tag.name} link={tagHref(tag)} />
    </li>
  ));

  const studioURL = getUrlBySite(scene.urls, "Studio");

  return (
    <>
      <Card className="scene-info">
        <Card.Header>
          <h3>
          <a target="_blank" href={"/scenes/" + scene.id}>
            {scene.deleted || pendingEditCount > 0 ? (
              <del>{scene.title} ({scene.deleted ? "Deleted" : "Being Deleted"})</del>
            ) : (
              <span>{scene.title}</span>
            )}
          </a>
          </h3>
          <h6>
            {scene.studio && (
              <>
                <Link to={studioHref(scene.studio)}>{scene.studio.name}</Link>
                <span className="mx-1">•</span>
              </>
            )}
            {scene.release_date}
          </h6>
        </Card.Header>
        <Card.Body className="ScenePhoto">
          <Image images={scene.images} emptyMessage="Scene has no image" />
        </Card.Body>
        <Card.Footer className="d-flex mx-1">
          <div className="scene-performers me-auto">{performers}</div>
          {scene.code && (
            <div className="ms-3">
              Studio Code: <strong>{scene.code}</strong>
            </div>
          )}
          {!!scene.duration && (
            <div title={`${scene.duration} seconds`} className="ms-3">
              Duration: <b>{formatDuration(scene.duration)}</b>
            </div>
          )}
          {scene.director && (
            <div className="ms-3">
              Director: <strong>{scene.director}</strong>
            </div>
          )}
        </Card.Footer>
      </Card>
      <div className="float-end">
        {scene.urls.map((u) => (
          <a href={u.url} target="_blank" rel="noreferrer noopener" key={u.url}>
            <img src={u.site.icon} alt="" className="SiteLink-icon" />
          </a>
        ))}
      </div>
      <div className="scene-description">
        <h4>Description:</h4>
        <div>{scene.details}</div>
      </div>
      <div className="scene-tags">
        <h6>Tags:</h6>
        <ul className="scene-tag-list">{tags}</ul>
      </div>
      {studioURL && (
        <>
          <hr />
          <div>
            <b className="me-2">Studio URL:</b>
            <a href={studioURL} target="_blank" rel="noopener noreferrer">
              {studioURL}
            </a>
          </div>
        </>
      )}
    </>
  );
};

export default SceneCard;
