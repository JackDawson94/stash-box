import { FC, useState, useEffect } from "react";
import { Button, Form, Row, Col, Card } from "react-bootstrap";
import Title from "src/components/title";
import { useApolloClient } from "@apollo/client";
import { SceneVariables, Scene } from "src/graphql/definitions/Scene";
import SceneQuery from "src/graphql/queries/Scene.gql";

import { usePagination } from "src/hooks";
import Pagination from "src/components/pagination";

import { usePapaParse } from "react-papaparse";
import Table from "react-bootstrap/Table";
import Image from "src/components/image";

import {
  GenderIcon,
  TagLink,
  PerformerName,
  Icon,
} from "src/components/fragments";
import {
  tagHref,
  formatDuration,
  getUrlBySite,
  compareByName,
} from "src/utils";
import { URLList } from "src/components/list";
import { TargetTypeEnum } from "src/graphql";
import PendingEditsCountQuery from "src/graphql/queries/PendingEditsCount.gql";
import {
  PendingEditsCount,
  PendingEditsCountVariables,
} from "src/graphql/definitions/PendingEditsCount";

const ScenesCompareComponent: FC = () => {
  const client = useApolloClient();
  const { readString } = usePapaParse();
  const { jsonToCSV } = usePapaParse();
  const { page, setPage } = usePagination();
  const [sceneAId, setSceneAId] = useState<string | undefined>("");
  const [sceneBId, setSceneBId] = useState<string | undefined>("");
  const [pagesNumber, setPagesNumber] = useState<int | undefined>(0);

  const [loadedA, setLoadedA] = useState<boolean | undefined>("false");
  const [sceneA, setSceneA] = useState("");
  const [loadedB, setLoadedB] = useState<boolean | undefined>("false");
  const [sceneB, setSceneB] = useState("");
  const [sceneAEditsCount, setSceneAEditsCount] = useState(0);
  const [sceneBEditsCount, setSceneBEditsCount] = useState(0);

  const [scenesListFile, setScenesListFile] = useState("");
  const [scenesList, setScenesList] = useState({});

  const [sceneTable, setsceneTable] = useState({
    title_difflib: "",
    studio: "",
    image_phash: "",
    image_ahash: "",
    urls: "",
  });

  const sceneTablePresenter = (value) => {
    switch (value) {
      case "1.0":
        return <td className="text-danger fw-bold">Identical</td>;
      case "0":
        return <td className="text-success fw-bold">Different</td>;
      default:
        return <td>{value}</td>;
    }
  };

  const parseScenesFile = (scenesCSV: string) => {
    readString(scenesCSV, {
      worker: false,
      header: true,
      skipEmptyLines: true,
      newline: "\r\n",
      transformHeader: (value: string): string => {
        return value.replace("/\\r/g", "").trim();
      },
      transform: (value: string): string => {
        return value.replace("/\\r/g", "").trim();
      },
      complete: (results) => {
        console.log(results);
        setScenesList(results);
        setPagesNumber(results.data.length);
      },
    });
  };

  const onLoadScenes = () => {
    if (scenesListFile && scenesListFile.type == "text/csv") {
      const reader = new FileReader();
      reader.onload = (e) =>
        e.target?.result && parseScenesFile(e.target.result);
      reader.onerror = () => setScenesList({});
      reader.onabort = () => setScenesList({});
      reader.readAsText(scenesListFile);
    } else {
      alert("Invalid scene file selected");
    }
  };

  const onSaveScenes = () => {
    const saveCSV = jsonToCSV(JSON.stringify(scenesList), {
      header: true,
      skipEmptyLines: true,
      newline: "\r\n",
    });
    console.log(saveCSV);
    const element = document.createElement("a");
    const file = new Blob([saveCSV], {
      type: "data:text/csv;charset=utf-8",
    });
    element.href = URL.createObjectURL(file);
    element.download = scenesListFile.name;
    document.body.appendChild(element);
    element.click();
    return null;
  };

  const getScenePerformers = (scene) => {
    return scene.performers
      .map((performance) => {
        const { performer } = performance;
        return (
          <div className="scene-performer">
            <GenderIcon gender={performer.gender} />
            <PerformerName performer={performer} as={performance.as} />
          </div>
        );
      })
      .map((p, index) => (index % 2 === 2 ? [" • ", p] : p));
  };

  const getSceneTags = (scene) => {
    return [...scene.tags].sort(compareByName).map((tag) => (
      <li key={tag.name}>
        <TagLink title={tag.name} link={tagHref(tag)} />
      </li>
    ));
  };

  const getSceneFingerprints = (scene) => {
    function maybeRenderSubmitted(fingerprint: Fingerprint) {
      if (fingerprint.user_submitted) {
        return (
          <span className="user-submitted" title="Submitted by you">
            <Icon icon={faCheckCircle} />
          </span>
        );
      }
    }
    return scene.fingerprints.map((fingerprint) => (
      <tr key={fingerprint.hash}>
        <td>{fingerprint.algorithm}</td>
        <td className="font-monospace">{fingerprint.hash}</td>
        <td>
          <span title={`${fingerprint.duration}s`}>
            {formatDuration(fingerprint.duration)}
          </span>
        </td>
        <td>
          {fingerprint.submissions}
          {maybeRenderSubmitted(fingerprint)}
        </td>
      </tr>
    ));
  };

  useEffect(() => {
    const queryLoadScenes = async () => {
      if (!sceneAId) {
        setLoadedA("false");
        setSceneA("");
      }
      if (!sceneBId) {
        setLoadedB("false");
        setSceneB("");
      }
      if (!sceneAId || !sceneBId) {
        return null;
      }

      const { data } = await client.query<Scene | SceneVariables>({
        query: SceneQuery,
        variables: { id: sceneAId },
      });

      const sceneAData = data?.findScene;
      if (!sceneAData) {
        alert("SceneA could not be found");
        return;
      }
      setSceneA(sceneAData);

      const { data: editData } = await client.query<
        PendingEditsCount,
        PendingEditsCountVariables
      >({
        query: PendingEditsCountQuery,
        variables: {
          type: TargetTypeEnum.SCENE,
          id: sceneAId,
          operation: "DESTROY",
        },
      });
      setSceneAEditsCount(editData?.queryEdits.count);

      setLoadedA("true");

      const { data: data2 } = await client.query<Scene | SceneVariables>({
        query: SceneQuery,
        variables: { id: sceneBId },
      });

      const sceneBData = data2?.findScene;
      if (!sceneBData) {
        alert("SceneB could not be found");
        return;
      }
      setSceneB(sceneBData);

      const { data: editData2 } = await client.query<
        PendingEditsCount,
        PendingEditsCountVariables
      >({
        query: PendingEditsCountQuery,
        variables: {
          type: TargetTypeEnum.SCENE,
          id: sceneBId,
          operation: "DESTROY",
        },
      });
      setSceneBEditsCount(editData?.queryEdits.count);

      setLoadedB("true");
    };
    queryLoadScenes();
  }, [sceneAId, sceneBId]);

  useEffect(() => {
    const setCurrentScenes = () => {
      // Check if data has been loaded
      if (scenesList && scenesList.data && scenesList.data.length > 0) {
        console.log(scenesList.data[page - 1]);
        setSceneAId(scenesList.data[page - 1].SceneA_ID);
        setSceneBId(scenesList.data[page - 1].SceneB_ID);
        setsceneTable((previousState) => {
          return {
            ...previousState,
            title_difflib: scenesList.data[page - 1].Title_difflib,
            image_phash: scenesList.data[page - 1].Image_phash,
            image_ahash: scenesList.data[page - 1].Image_ahash,
            urls: scenesList.data[page - 1].URLs_check,
          };
        });
      }
    };
    setCurrentScenes();
  }, [scenesList, page]);

  return (
    <>
      <Title page="Scenes Compare" />
      <h3>Compare Scenes</h3>
      <Row>
        <Form.Group controlId="scenesFile" className="col-4">
          <Form.Control
            type="file"
            accept={".csv"}
            size="sm"
            onChange={(v) => setScenesListFile(v.target.files[0])}
          />
        </Form.Group>
        <Button
          variant="primary"
          className="col-1 ms-1 mb-4"
          size="sm"
          onClick={onLoadScenes}
        >
          Load Scenes
        </Button>
        <Button
          variant="primary"
          className="col-1 ms-1 mb-4"
          size="sm"
          onClick={onSaveScenes}
        >
          Save State
        </Button>
        <Col />
        <Col className="col-4">
          <Pagination
            onClick={setPage}
            count={pagesNumber}
            active={page}
            perPage={1}
            showCount
          />
        </Col>
      </Row>
      <Row className="mb-4">
        <Col className="col-7">
          <Button variant="danger" className="ms-1">
            Dupe Delete A
          </Button>
          <Button variant="danger" className="ms-1">
            Dupe Delete B
          </Button>
          <Button
            variant="warning"
            className="ms-1"
            title="Save the status to CSV file to be added to the shared spreadsheet"
          >
            Dupe Merge
          </Button>
          <Button variant="secondary" className="ms-1">
            Redistribution
          </Button>
          <Button
            variant="secondary"
            className="ms-1"
            title="Mark as false positive"
          >
            Different
          </Button>
        </Col>
        <Col>
          <Table className="col-5">
            <tbody>
              <tr>
                <td>
                  <b># Fingerprints per Scene</b>
                </td>
                <td>
                  Scene A:{" "}
                  {sceneA.fingerprints && sceneA.fingerprints.length >= 0
                    ? sceneA.fingerprints.length
                    : ""}
                </td>
                <td>
                  Scene B:{" "}
                  {sceneB.fingerprints && sceneB.fingerprints.length >= 0
                    ? sceneB.fingerprints.length
                    : ""}
                </td>
              </tr>
            </tbody>
          </Table>
        </Col>
      </Row>
      <Row>
        <Table>
          <thead>
            <tr>
              <th>Title (difflib)</th>
              <th>Studio</th>
              <th>Image (PHASH)</th>
              <th>Image (AHASH)</th>
              <th>URLs</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              {sceneTablePresenter(sceneTable.title_difflib)}
              {sceneTablePresenter(sceneTable.studio)}
              {sceneTablePresenter(sceneTable.image_phash)}
              {sceneTablePresenter(sceneTable.image_ahash)}
              {sceneTablePresenter(sceneTable.urls)}
            </tr>
          </tbody>
        </Table>
      </Row>
      {loadedA && loadedB && sceneA && sceneB && (
        <>
          <Row>
            <div className="col-6">
              <Card className="scene-info">
                <Card.Header>
                  <h3>
                    <span>
                      <a
                        href={"/scenes/" + sceneA.id}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {sceneA.title}
                      </a>
                      {sceneAEditsCount > 0 && " (Delete In Progress)"}
                    </span>
                  </h3>
                  <h6>
                    {sceneA.studio && (
                      <>
                        {sceneA.studio.name}
                        <span className="mx-1">•</span>
                      </>
                    )}
                    {sceneA.release_date}
                  </h6>
                </Card.Header>
                <Card.Body className="ScenePhoto">
                  <Image
                    images={sceneA.images}
                    emptyMessage="Scene has no image"
                  />
                </Card.Body>
                <Card.Footer className="d-flex mx-1">
                  <div className="scene-performers me-auto">
                    {getScenePerformers(sceneA)}
                  </div>
                  {sceneA.code && (
                    <div className="ms-3">
                      Studio Code: <strong>{sceneA.code}</strong>
                    </div>
                  )}
                  {!!sceneA.duration && (
                    <div title={`${sceneA.duration} seconds`} className="ms-3">
                      Duration: <b>{formatDuration(sceneA.duration)}</b>
                    </div>
                  )}
                  {sceneA.director && (
                    <div className="ms-3">
                      Director: <strong>{sceneA.director}</strong>
                    </div>
                  )}
                </Card.Footer>
              </Card>
              <div className="scene-description">
                <h4>Description:</h4>
                <div>{sceneA.details}</div>
                <div className="scene-tags">
                  <h6>Tags:</h6>
                  <ul className="scene-tag-list">{getSceneTags(sceneA)}</ul>
                </div>
                {getUrlBySite(sceneA.urls, "Studio") && (
                  <>
                    <hr />
                    <div>
                      <b>Studio URL: </b>
                      <a
                        href={getUrlBySite(sceneA.urls, "Studio")}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {getUrlBySite(sceneA.urls, "Studio")}
                      </a>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="col-6">
              <Card className="scene-info">
                <Card.Header>
                  <h3>
                    <span>
                      <a
                        href={"/scenes/" + sceneB.id}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {sceneB.title}
                      </a>
                      {sceneBEditsCount > 0 && " (Delete In Progress)"}
                    </span>
                  </h3>
                  <h6>
                    {sceneB.studio && (
                      <>
                        {sceneB.studio.name}
                        <span className="mx-1">•</span>
                      </>
                    )}
                    {sceneB.release_date}
                  </h6>
                </Card.Header>
                <Card.Body className="ScenePhoto">
                  <Image
                    images={sceneB.images}
                    emptyMessage="Scene has no image"
                  />
                </Card.Body>
                <Card.Footer className="d-flex mx-1">
                  <div className="scene-performers me-auto">
                    {getScenePerformers(sceneB)}
                  </div>
                  {sceneB.code && (
                    <div className="ms-3">
                      Studio Code: <strong>{sceneB.code}</strong>
                    </div>
                  )}
                  {!!sceneB.duration && (
                    <div title={`${sceneB.duration} seconds`} className="ms-3">
                      Duration: <b>{formatDuration(sceneB.duration)}</b>
                    </div>
                  )}
                  {sceneB.director && (
                    <div className="ms-3">
                      Director: <strong>{sceneB.director}</strong>
                    </div>
                  )}
                </Card.Footer>
              </Card>
              <div className="scene-description">
                <h4>Description:</h4>
                <div>{sceneB.details}</div>
                <div className="scene-tags">
                  <h6>Tags:</h6>
                  <ul className="scene-tag-list">{getSceneTags(sceneB)}</ul>
                </div>
                {getUrlBySite(sceneB.urls, "Studio") && (
                  <>
                    <hr />
                    <div>
                      <b>Studio URL: </b>
                      <a
                        href={getUrlBySite(sceneB.urls, "Studio")}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {getUrlBySite(sceneB.urls, "Studio")}
                      </a>
                    </div>
                  </>
                )}
              </div>
            </div>
          </Row>
          <Row className="border-top mt-5">
            <h4>Fingerprints:</h4>
            <div className="scene-fingerprints my-4 col-6">
              {sceneA.fingerprints.length === 0 ? (
                <h6>No fingerprints found for this scene.</h6>
              ) : (
                <Table striped variant="dark" size="sm">
                  <thead>
                    <tr>
                      <td>
                        <b>Alg.</b>
                      </td>
                      <td>
                        <b>Hash</b>
                      </td>
                      <td>
                        <b>Dur.</b>
                      </td>
                      <td>
                        <b>#</b>
                      </td>
                    </tr>
                  </thead>
                  <tbody>{getSceneFingerprints(sceneA)}</tbody>
                </Table>
              )}
            </div>

            <div className="scene-fingerprints my-4 col-6">
              {sceneB.fingerprints.length === 0 ? (
                <h6>No fingerprints found for this scene.</h6>
              ) : (
                <Table striped variant="dark" size="sm">
                  <thead>
                    <tr>
                      <td>
                        <b>Alg.</b>
                      </td>
                      <td>
                        <b>Hash</b>
                      </td>
                      <td>
                        <b>Dur.</b>
                      </td>
                      <td>
                        <b>#</b>
                      </td>
                    </tr>
                  </thead>
                  <tbody>{getSceneFingerprints(sceneB)}</tbody>
                </Table>
              )}
            </div>
          </Row>
          <Row className="border-top mt-5">
            <h4 className="mb-2 mt-2">Links:</h4>
            <div className="col-6">
              <URLList urls={sceneA.urls} />
            </div>
            <div className="col-6">
              <URLList urls={sceneB.urls} />
            </div>
          </Row>
        </>
      )}
    </>
  );
};

export default ScenesCompareComponent;
