// Populate the sidebar
//
// This is a script, and not included directly in the page, to control the total size of the book.
// The TOC contains an entry for each page, so if each page includes a copy of the TOC,
// the total size of the page becomes O(n**2).
class MDBookSidebarScrollbox extends HTMLElement {
    constructor() {
        super();
    }
    connectedCallback() {
        this.innerHTML = '<ol class="chapter"><li class="chapter-item expanded "><a href="preface.html"><strong aria-hidden="true">1.</strong> Preface</a></li><li class="chapter-item expanded "><a href="part1_intro.html"><strong aria-hidden="true">2.</strong> Part I - Foundations &amp; Surveys</a></li><li><ol class="section"><li class="chapter-item expanded "><a href="chapter_01_why_a_cluster_manager.html"><strong aria-hidden="true">2.1.</strong> Chapter 1 - Why a Cluster Manager?</a></li><li class="chapter-item expanded "><a href="chapter_02_roles_responsibilities.html"><strong aria-hidden="true">2.2.</strong> Chapter 2 - Roles &amp; Responsibilities</a></li><li class="chapter-item expanded "><a href="chapter_03_core_concepts_and_terminology.html"><strong aria-hidden="true">2.3.</strong> Chapter 3 - Core Concepts and Terminology</a></li><li class="chapter-item expanded "><a href="chapter_04_failure_models.html"><strong aria-hidden="true">2.4.</strong> Chapter 4 - Failure Models &amp; Fault Tolerance</a></li><li class="chapter-item expanded "><a href="chapter_05_consistency_models.html"><strong aria-hidden="true">2.5.</strong> Chapter 5 - Consistency Models &amp; Guarantees</a></li><li class="chapter-item expanded "><a href="chapter_06_control_plane_patterns.html"><strong aria-hidden="true">2.6.</strong> Chapter 6 - Control Plane Patterns &amp; Primitives</a></li><li class="chapter-item expanded "><a href="chapter_07_comparative_survey.html"><strong aria-hidden="true">2.7.</strong> Chapter 7 - Comparative Survey</a></li><li class="chapter-item expanded "><a href="chapter_08_design_constraints.html"><strong aria-hidden="true">2.8.</strong> Chapter 8 - Design Constraints &amp; NFRs</a></li></ol></li><li class="chapter-item expanded "><a href="part2_intro.html"><strong aria-hidden="true">3.</strong> Part II - Goals, API Contracts &amp; High-Level Architecture</a></li><li><ol class="section"><li class="chapter-item expanded "><a href="chapter_09_goals.html"><strong aria-hidden="true">3.1.</strong> Chapter 9 - Product &amp; Operational Goals</a></li><li class="chapter-item expanded "><a href="chapter_10_architecture_choices.html"><strong aria-hidden="true">3.2.</strong> Chapter 10 - High-Level Architecture Choices</a></li><li class="chapter-item expanded "><a href="chapter_11_apis_contracts.html"><strong aria-hidden="true">3.3.</strong> Chapter 11 - APIs &amp; Contracts</a></li><li class="chapter-item expanded "><a href="chapter_12_membership_discovery.html"><strong aria-hidden="true">3.4.</strong> Chapter 12 - Membership &amp; Discovery</a></li><li class="chapter-item expanded "><a href="chapter_13_placement.html"><strong aria-hidden="true">3.5.</strong> Chapter 13 - Placement &amp; Replica Assignment</a></li><li class="chapter-item expanded "><a href="chapter_14_rebalancing.html"><strong aria-hidden="true">3.6.</strong> Chapter 14 - Rebalancing &amp; Data Movement</a></li><li class="chapter-item expanded "><a href="chapter_15_replication_coordination.html"><strong aria-hidden="true">3.7.</strong> Chapter 15 - Replication Coordination</a></li><li class="chapter-item expanded "><a href="chapter_16_recovery_repair.html"><strong aria-hidden="true">3.8.</strong> Chapter 16 - Recovery &amp; Repair</a></li><li class="chapter-item expanded "><a href="chapter_17_configuration_management.html"><strong aria-hidden="true">3.9.</strong> Chapter 17 - Configuration Management</a></li><li class="chapter-item expanded "><a href="chapter_18_security.html"><strong aria-hidden="true">3.10.</strong> Chapter 18 - Security &amp; Multi-Tenant Isolation</a></li><li class="chapter-item expanded "><a href="chapter_19_observability.html"><strong aria-hidden="true">3.11.</strong> Chapter 19 - Observability &amp; Tooling</a></li><li class="chapter-item expanded "><a href="chapter_20_testing.html"><strong aria-hidden="true">3.12.</strong> Chapter 20 - Testing Strategy &amp; Verification</a></li></ol></li><li class="chapter-item expanded "><a href="part3_intro.html"><strong aria-hidden="true">4.</strong> Part III - Implementation</a></li><li><ol class="section"><li class="chapter-item expanded "><a href="chapter_21_bootstrap.html"><strong aria-hidden="true">4.1.</strong> Chapter 21 - Project Bootstrap</a></li><li class="chapter-item expanded "><a href="chapter_22_core_interfaces.html"><strong aria-hidden="true">4.2.</strong> Chapter 22 - Core Interfaces &amp; Mocks</a></li><li class="chapter-item expanded "><a href="chapter_23_membership.html"><strong aria-hidden="true">4.3.</strong> Chapter 23 - Membership Service</a></li><li class="chapter-item expanded "><a href="chapter_24_failure_detector.html"><strong aria-hidden="true">4.4.</strong> Chapter 24 - Failure Detector</a></li><li class="chapter-item expanded "><a href="chapter_25_leader_election.html"><strong aria-hidden="true">4.5.</strong> Chapter 25 - Leader Election</a></li><li class="chapter-item expanded "><a href="chapter_26_metadata_manager.html"><strong aria-hidden="true">4.6.</strong> Chapter 26 - Metadata Manager</a></li><li class="chapter-item expanded "><a href="chapter_27_placement_engine.html"><strong aria-hidden="true">4.7.</strong> Chapter 27 - Placement Engine</a></li><li class="chapter-item expanded "><a href="chapter_28_rebalancer.html"><strong aria-hidden="true">4.8.</strong> Chapter 28 - Rebalancer &amp; Migrator</a></li><li class="chapter-item expanded "><a href="chapter_29_replication_coordinator.html"><strong aria-hidden="true">4.9.</strong> Chapter 29 - Replication Coordinator</a></li><li class="chapter-item expanded "><a href="chapter_30_client_coordinator.html"><strong aria-hidden="true">4.10.</strong> Chapter 30 - Client-Facing Coordinator</a></li><li class="chapter-item expanded "><a href="chapter_31_admin_api.html"><strong aria-hidden="true">4.11.</strong> Chapter 31 - Admin API &amp; CLI</a></li><li class="chapter-item expanded "><a href="chapter_32_health_metrics.html"><strong aria-hidden="true">4.12.</strong> Chapter 32 - Health &amp; Metrics</a></li><li class="chapter-item expanded "><a href="chapter_33_testing_chaos.html"><strong aria-hidden="true">4.13.</strong> Chapter 33 - Testing &amp; Chaos</a></li><li class="chapter-item expanded "><a href="chapter_34_deployment.html"><strong aria-hidden="true">4.14.</strong> Chapter 34 - Deployment &amp; Operations</a></li><li class="chapter-item expanded "><a href="chapter_35_performance_tuning.html"><strong aria-hidden="true">4.15.</strong> Chapter 35 - Performance Tuning</a></li><li class="chapter-item expanded "><a href="chapter_36_hardening.html"><strong aria-hidden="true">4.16.</strong> Chapter 36 - Hardening &amp; Production Checklist</a></li></ol></li><li class="chapter-item expanded "><a href="appendix_intro.html"><strong aria-hidden="true">5.</strong> Appendices</a></li><li><ol class="section"><li class="chapter-item expanded "><a href="appendix_a_glossary.html"><strong aria-hidden="true">5.1.</strong> Appendix A - Glossary</a></li><li class="chapter-item expanded "><a href="appendix_b_protocols.html"><strong aria-hidden="true">5.2.</strong> Appendix B - Protocol Specs</a></li><li class="chapter-item expanded "><a href="appendix_c_api_stubs.html"><strong aria-hidden="true">5.3.</strong> Appendix C - API Stubs</a></li><li class="chapter-item expanded "><a href="appendix_d_simulations.html"><strong aria-hidden="true">5.4.</strong> Appendix D - Simulation Scenarios</a></li><li class="chapter-item expanded "><a href="appendix_e_rfc_template.html"><strong aria-hidden="true">5.5.</strong> Appendix E - RFC Template</a></li><li class="chapter-item expanded "><a href="appendix_f_further_reading.html"><strong aria-hidden="true">5.6.</strong> Appendix F - Further Reading</a></li></ol></li></ol>';
        // Set the current, active page, and reveal it if it's hidden
        let current_page = document.location.href.toString().split("#")[0].split("?")[0];
        if (current_page.endsWith("/")) {
            current_page += "index.html";
        }
        var links = Array.prototype.slice.call(this.querySelectorAll("a"));
        var l = links.length;
        for (var i = 0; i < l; ++i) {
            var link = links[i];
            var href = link.getAttribute("href");
            if (href && !href.startsWith("#") && !/^(?:[a-z+]+:)?\/\//.test(href)) {
                link.href = path_to_root + href;
            }
            // The "index" page is supposed to alias the first chapter in the book.
            if (link.href === current_page || (i === 0 && path_to_root === "" && current_page.endsWith("/index.html"))) {
                link.classList.add("active");
                var parent = link.parentElement;
                if (parent && parent.classList.contains("chapter-item")) {
                    parent.classList.add("expanded");
                }
                while (parent) {
                    if (parent.tagName === "LI" && parent.previousElementSibling) {
                        if (parent.previousElementSibling.classList.contains("chapter-item")) {
                            parent.previousElementSibling.classList.add("expanded");
                        }
                    }
                    parent = parent.parentElement;
                }
            }
        }
        // Track and set sidebar scroll position
        this.addEventListener('click', function(e) {
            if (e.target.tagName === 'A') {
                sessionStorage.setItem('sidebar-scroll', this.scrollTop);
            }
        }, { passive: true });
        var sidebarScrollTop = sessionStorage.getItem('sidebar-scroll');
        sessionStorage.removeItem('sidebar-scroll');
        if (sidebarScrollTop) {
            // preserve sidebar scroll position when navigating via links within sidebar
            this.scrollTop = sidebarScrollTop;
        } else {
            // scroll sidebar to current active section when navigating via "next/previous chapter" buttons
            var activeSection = document.querySelector('#sidebar .active');
            if (activeSection) {
                activeSection.scrollIntoView({ block: 'center' });
            }
        }
        // Toggle buttons
        var sidebarAnchorToggles = document.querySelectorAll('#sidebar a.toggle');
        function toggleSection(ev) {
            ev.currentTarget.parentElement.classList.toggle('expanded');
        }
        Array.from(sidebarAnchorToggles).forEach(function (el) {
            el.addEventListener('click', toggleSection);
        });
    }
}
window.customElements.define("mdbook-sidebar-scrollbox", MDBookSidebarScrollbox);
