import { FC, useState, useEffect } from "react";
import { Button, Form, Row, Col, Card, Modal } from "react-bootstrap";
import Title from "src/components/title";
import { useApolloClient } from "@apollo/client";
import { TargetTypeEnum, OperationEnum } from "src/graphql";
import { SceneVariables, Scene } from "src/graphql/definitions/Scene";
import SceneQuery from "src/graphql/queries/Scene.gql";
import SceneCard from "./SceneCard"

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
import PendingEditsCountQuery from "src/graphql/queries/PendingEditsCount.gql";
import {
  PendingEditsCount,
  PendingEditsCountVariables,
} from "src/graphql/definitions/PendingEditsCount";
import { faCheckCircle } from "@fortawesome/free-solid-svg-icons";
import SceneDelete from "./SceneDelete"

enum STATUS_ENUM {
  REVIEW = "Review",
  DELETE = "Delete",
  MERGE = "Mege",
  REDISTRIB = "Redistribution",
  DIFF = "Different"
}

const ScenesCompareComponent: FC = () => {
  const client = useApolloClient();
  const { readString } = usePapaParse();
  const { jsonToCSV } = usePapaParse();
  const { page, setPage } = usePagination();
  const [sceneAId, setSceneAId] = useState<string | undefined>("");
  const [sceneBId, setSceneBId] = useState<string | undefined>("");
  const [pagesNumber, setPagesNumber] = useState<int | undefined>(0);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [sceneToDelete, setSceneToDelete] = useState("");
  const [sceneToDeleteReason, setSceneToDeleteReason] = useState("");

  const [loadedA, setLoadedA] = useState<boolean | undefined>("false");
  const [sceneA, setSceneA] = useState("");
  const [loadedB, setLoadedB] = useState<boolean | undefined>("false");
  const [sceneB, setSceneB] = useState("");
  const [sceneAEditsCount, setSceneAEditsCount] = useState(0);
  const [sceneBEditsCount, setSceneBEditsCount] = useState(0);
  const [comparisonStatus, setComparisonStatus] = useState(STATUS_ENUM.REVIEW);

  const [scenesListFile, setScenesListFile] = useState("");
  const [scenesList, setScenesList] = useState({});
  const [scenesListFilename, setScenesListFilename] = useState("");

  const handleCloseDeleteModal = () => setShowDeleteModal(false);
  const handleShowDeleteModal = (scene, reason) =>{
    if(scene && scene.id){
      setSceneToDelete(scene);
      setSceneToDeleteReason(reason);
      setShowDeleteModal(true);
      markStatus(STATUS_ENUM.DELETE)
    }
    else{
      alert("No scene selected")
    }
  }

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

  const parseScenesFile = (scenesCSV: string, filtered: boolean) => {
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
        results.filteredData = filtered ? results.data.filter(item => typeof item.Status == 'undefined' || item.Status == STATUS_ENUM.REVIEW ) : results.data
        setScenesList(results);
        setPagesNumber(results.filteredData.length);
        setPage(1);
      },
    });
  };

  const onLoadScenes = (filtered = true) => {
    if (scenesListFile && scenesListFile.type == "text/csv") {
      setScenesListFilename(scenesListFile.name)
      setPage(1)

      const reader = new FileReader();
      reader.onload = (e) =>
        e.target?.result && parseScenesFile(e.target.result, filtered);
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
    element.download = scenesListFilename;
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

  const markStatus = (status) => {
    const comparisonId = scenesList.data.findIndex( el => el.SceneA_ID == scenesList.filteredData[page - 1].SceneA_ID && el.SceneB_ID == scenesList.filteredData[page - 1].SceneB_ID)
    scenesList.data[comparisonId].Status = status
    scenesList.filteredData[page - 1].Status = status
    setComparisonStatus(status)
    updateStorage()
  }

  const clearState = () => {
    window.localStorage.clear()
    window.location.reload()
  }

  const updateStorage = () => {
    window.localStorage.setItem("savedState", JSON.stringify({filename:scenesListFilename, list:scenesList}))
  }

  const loadStorage = () => {
    const savedData = window.localStorage.getItem("savedState")
    if(savedData !== null){
      let {filename, list} = JSON.parse(savedData);
      setScenesListFilename(filename)
      setScenesList(list)
      setPagesNumber(list.filteredData.length);
      setPage(1);
    }
  }

// Load LocalStorage on page first load
  useEffect(loadStorage, [])

// If one of the scenes is already deleted, or has a delete edit pending, mark as already handled
  useEffect(() => {
    if (scenesList && scenesList.filteredData && loadedA && loadedB && scenesList.filteredData[page - 1].Status !== STATUS_ENUM.DELETE && (sceneA.deleted || sceneB.deleted || sceneAEditsCount > 0 || sceneBEditsCount > 0) ) {
      setComparisonStatus(STATUS_ENUM.DELETE)
      markStatus(STATUS_ENUM.DELETE)
      updateStorage()
    }
  }, [sceneAEditsCount, sceneBEditsCount]);

  useEffect(() => {
    const queryLoadScenes = async () => {
      setLoadedA("false");
      setLoadedB("false");
      if (!sceneAId) {
        setSceneA("");
      }
      if (!sceneBId) {
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
          operation: OperationEnum.DESTROY
        },
      });
      setSceneAEditsCount(editData.queryEdits.count);

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
          operation: OperationEnum.DESTROY
        },
      });
      setSceneBEditsCount(editData2.queryEdits.count);

      setLoadedB("true");
    };
    queryLoadScenes();
  }, [sceneAId, sceneBId]);

  useEffect(() => {
    const setCurrentScenes = () => {
      // Check if data has been loaded
      if (scenesList && scenesList.filteredData && scenesList.filteredData.length > 0) {
        console.log(scenesList.filteredData[page - 1]);
        setSceneAId(scenesList.filteredData[page - 1].SceneA_ID);
        setSceneBId(scenesList.filteredData[page - 1].SceneB_ID);
        setsceneTable((previousState) => {
          return {
            ...previousState,
            title_difflib: scenesList.filteredData[page - 1].Title_difflib,
            image_phash: scenesList.filteredData[page - 1].Image_phash,
            image_ahash: scenesList.filteredData[page - 1].Image_ahash,
            urls: scenesList.filteredData[page - 1].URLs_check,
          };
        });
        setComparisonStatus(scenesList.filteredData[page - 1].Status);
      }
    };
    setCurrentScenes();
  }, [scenesList, page, comparisonStatus]);

  return (
    <>
      <Title page="Scenes Compare" />
      <h3>Compare Scenes</h3>
      <Row>
        <Form.Group controlId="scenesFile" className="col-3">
          <Form.Control
            type="file"
            accept={".csv"}
            size="sm"
            defaultValue={scenesListFile}
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
          className="col-1 ms-1 mb-4 text-truncate"
          size="sm"
          onClick={() => onLoadScenes(false)}
        >
          Load Unfiltered
        </Button>
        <Button
          variant="primary"
          className="col-1 ms-1 mb-4"
          size="sm"
          onClick={onSaveScenes}
        >
          Save State
        </Button>
        <Button
          variant="secondary"
          className="col-1 ms-1 mb-4"
          size="sm"
          onClick={clearState}
        >
          Clear
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
          <Button variant="danger" className="ms-1" onClick={() => {(sceneAEditsCount > 0 || sceneA.deleted) ? alert("Scene A already marked for deletion") : handleShowDeleteModal(sceneA,"Dupe of https://stashdb.org/scenes/"+ sceneB.id + "")}}>
            Dupe Delete A
          </Button>
          <Button variant="danger" className="ms-1" onClick={() => {(sceneBEditsCount > 0 || sceneB.deleted) ? alert("Scene B already marked for deletion") : handleShowDeleteModal(sceneB,"Dupe of https://stashdb.org/scenes/"+ sceneA.id + "")}}>
            Dupe Delete B
          </Button>
          <Button
            variant="warning"
            className="ms-1"
            title="Save the status to CSV file to be added to the shared spreadsheet"
            onClick={() => markStatus(STATUS_ENUM.MERGE)}
          >
            Dupe Merge
          </Button>
          <Button variant="secondary" className="ms-1" onClick={() => markStatus(STATUS_ENUM.REDISTRIB)}>
            Redistribution
          </Button>
          <Button
            variant="secondary"
            className="ms-1"
            title="Mark as false positive"
            onClick={() => markStatus(STATUS_ENUM.DIFF)}
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
      {(loadedA && loadedB && sceneA && sceneB && comparisonStatus !== STATUS_ENUM.REVIEW) &&
        <Row className="mb-3 col-6 text-center mx-auto">
        <h4 className={comparisonStatus == STATUS_ENUM.DELETE ? "text-alert" : comparisonStatus == STATUS_ENUM.MERGE ? "text-warning" : ""}>Scenes marked as {comparisonStatus} <b></b></h4>
        </Row>
      }
      {loadedA && loadedB && sceneA && sceneB && (
        <>
          <Row>
            <div className="col-6">
              <SceneCard scene={sceneA} />
            </div>
            <div className="col-6">
              <SceneCard scene={sceneB} />
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
      <Modal show={showDeleteModal} onHide={handleCloseDeleteModal}>
        <Modal.Header closeButton>
          Delete Scene {sceneToDelete == sceneA ? "A" : "B"}
        </Modal.Header>
        <Modal.Body>
          <SceneDelete scene={sceneToDelete} reason={sceneToDeleteReason} exitCallback={handleCloseDeleteModal} />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseDeleteModal}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default ScenesCompareComponent;
