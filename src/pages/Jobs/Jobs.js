import "./Jobs.css";
import React, { useEffect } from "react";
import SEO from "components/Common/SEO";
import { getPageTitle } from "lib/legacy";
import Card from "components/Common/Card";

function Jobs() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return (
    <SEO title={getPageTitle("Job Openings")}>
      <div className="default-container page-layout Referrals">
        <div className="mb-[40.25px] flex w-full max-w-[584px]">
          <div className="section-title-icon"></div>
          <div className="flex-start flex flex-col">
            <div className="mb-[8px] flex flex-row items-center text-xl font-medium text-slate-300">
              Jobs
            </div>
            <div className="text-sm text-slate-600">Job openings at XDX.</div>
          </div>
        </div>
        <div className="jobs-page-body">
          <NoJob />
        </div>
      </div>
    </SEO>
  );
}

function NoJob() {
  return (
    <Card title="No open positions at XDX currently">
      <div className="body-para">
        <p className="subheading">
          XDX is not actively looking for new hires at the moment. However, if you think you can contribute to the
          project, please email{" "}
          <a target="_blank" href="mailto:jobs@xdx.io" rel="noopener noreferrer">
            jobs@xdx.io
          </a>
          .
        </p>
      </div>
    </Card>
  );
}

export default Jobs;
