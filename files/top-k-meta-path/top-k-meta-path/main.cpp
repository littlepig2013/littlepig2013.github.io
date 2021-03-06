#include "HIN_Graph.h"
#include "DataReader.h"
#include "TopKCalculator.h"
#include "Utils.h"

#include <iostream>
#include <fstream>
#include <sstream>
#include <cstdlib>
#include <cstring>
#include <cctype>
#include <ctime>
#include <vector>

using namespace std;

void output(vector<pair<vector<double>, vector<int>>> topKMetaPaths, map<int, string> & edge_name, string output_file_name, int output_type) {
	if (topKMetaPaths.size() > 0) {
		if (output_type == 1 || output_type == 3) {
			bool invalid_edge_type_flag = false;
			cout << "TF-IDF" << "\t\t" << "tf" << "\t\t" << "idf" << "\t";
			cout << "length" << "\t" << "Meta Path" << endl;

			for (vector<pair<vector<double>, vector<int>>>::iterator iter = topKMetaPaths.begin(); iter != topKMetaPaths.end(); iter++) {
				vector<double> tfidf_info = iter->first;
				cout.precision(2);
				cout << scientific;

				cout << tfidf_info[0] << "\t";
				cout << tfidf_info[1] << "\t";
				cout.precision(4);
				cout << fixed;
				cout << tfidf_info[2] << "\t";
				
				cout << iter->second.size() << "\t";

				vector<int> temp_meta_path = iter->second;
				for (vector<int>::iterator iter = temp_meta_path.begin(); iter != temp_meta_path.end(); iter++) {
					if (edge_name.find(*iter) == edge_name.end() && edge_name.find(-(*iter)) == edge_name.end()) {
						invalid_edge_type_flag = true;
						break;
					}
				}

				if (!invalid_edge_type_flag) {
					for (vector<int>::iterator iter = temp_meta_path.begin(); iter != temp_meta_path.end() - 1; iter++) {
						int curr_edge_type = *iter;
						if (curr_edge_type > 0) {
							cout << edge_name[curr_edge_type];
						}
						else {
							cout << "[" << edge_name[-curr_edge_type] << "]^(-1)";
						}
						cout << " -> ";
					}
					int curr_edge_type = temp_meta_path.back();
					if (curr_edge_type > 0) {
						cout << edge_name[curr_edge_type];
					}
					else {
						cout << "[" << edge_name[-curr_edge_type] << "]^(-1)";
					}
					cout << endl;
				}
				else {
					cout << "Found some Invalid Edge Type" << endl;
				}
			}
		}

		if (output_type == 2 || output_type == 3) {
			vector<pair<double, vector<int>>> meta_paths;
			for (vector<pair<vector<double>, vector<int>>>::iterator iter = topKMetaPaths.begin(); iter != topKMetaPaths.end(); iter++) {
				meta_paths.push_back(make_pair(iter->first[0], iter->second));
			}
			TopKCalculator::saveToFile(meta_paths, output_file_name);

		}

	}
	else {
		cerr << "No Meta Path Found in the HIN Graph." << endl;
	}
}


void printUsage(const char* argv[]) {
	cout << "Usage: " << endl;
	cout << argv[0] << " --default dataset entityId1 entityId2 k" << endl;
	cout << argv[0] << " --advance dataset entityId1 entityId2 k output-type TF-IDF-type length-penalty (beta)" << endl;
	cout << argv[0] << " --train dataset" << endl;
	cout << endl;

	cout << "--advance mode:" << endl;
	
	cout << "\t output-type:" << endl;
	cout << "\t\t 1 -> typing ranking details in std::cout" << endl;
	cout << "\t\t 2 -> saving to a file" << endl;
	cout << "\t\t 3 -> both 1 and 2" << endl;	

	cout << "\t TF-IDF-type:" << endl;
	cout << "\t\t M-S -> MNI-based Support" << endl;
	cout << "\t\t S-M-S -> Strength-based M-S" << endl;
	cout << "\t\t B-S -> Binary-based Support" << endl;
	cout << "\t\t SLV1 -> Strength & Length based Version 1" << endl;
	cout << "\t\t SLV2 -> Strength & Length based Version 2" << endl;
	cout << "\t\t SP -> Shortest Path" << endl;

	cout << "\t length-penalty(l is the meta-path's length): " << endl;
	cout << "\t\t 1 -> beta^l (beta < 1)" << endl;
	cout << "\t\t 2 -> 1/factorial(l)" << endl;	
	cout << "\t\t 3 -> 1/l" << endl;
	cout << "\t\t 4 -> 1/e^l" << endl;
	cout << endl;


	cout << "--default mode:" << endl;
	cout << "\t output-type -> 1" << endl;
	cout << "\t TF-IDF-type -> S-M-S (MNIS in paper)" << endl;
	cout << "\t length-penalty -> 1" << endl;
	cout << "\t beta -> 0.3" << endl;
	cout << endl;

	cout << "--train mode:" << endl;
	cout << "\t get statistics of different node types and edge types(including the number of each node type, each edge type and the weight of each edge type" << endl;
	cout << "\t Please note that if you want to run any strength-based method, you should run training mode first to accelerate it" << endl;
	cout << endl; 
}

int main(int argc, const char * argv[]) {
	
	if (argc == 3){
		if(strcmp(argv[1], "--train") == 0 || strcmp(argv[1], "-t")){
			getMetaInfo(argv[2]);
			return 0;
		}
	}else if (argc > 5) {

		int penalty_type = DEFAULT_PENALTY_TYPE;
		double beta = DEFAULT_BETA;
		string tfidf_type = DEFAULT_TFIDF_TYPE;
		int output_type = DEFAULT_OUTPUT_TYPE;
		int score_function = DEFAULT_SCORE_FUNCTION;

		if (strcmp(argv[1], "--default") == 0 || strcmp(argv[1], "-d") == 0) {
			tfidfSetup(tfidf_type.c_str(), penalty_type, beta);
			//cout << argv[1] << " " << argc << " " << penalty_type << " " << tfidf_type << endl;
		}
		else if (strcmp(argv[1], "--advance") == 0 || strcmp(argv[1], "-a") == 0) {
			if (argc > 8) {
				output_type = atoi(argv[6]);
				tfidf_type = argv[7];
				penalty_type = atoi(argv[8]);
				if(penalty_type != 1 && penalty_type != 2){
					cerr << "The penalty_type parameter must be 1 or 2" << endl;
					return -1;
				}
			}
			if(penalty_type == 1 && argc > 9){
				beta = atof(argv[9]);
				if(beta <= 0 || beta >= 1){
					cerr << "The beta parameter must be greater than 0 and less than 1" << endl;
					return -1;
				}
			}
			tfidfSetup(tfidf_type.c_str(), penalty_type, beta);
			//cout << argv[1] << " " << argc << " " << penalty_type << " " << tfidf_type << endl;
		}else {
			printUsage(argv);
			return -1;
		}

		string dataset;
		int src, dst, k;
		dataset = argv[2];
		src = atoi(argv[3]);
		dst = atoi(argv[4]);
		k = atoi(argv[5]);

		clock_t t1, t2;

		HIN_Graph hin_graph_;

		map<int, vector<Edge>> adj;
		map<int, string> node_name;
		map<int, string> node_type_name;
		map<int, int> node_type_num;
		map<int, vector<int>> node_id_to_type;
		map<int, string> edge_name;

		hin_graph_ = loadHinGraph(dataset.c_str(), node_name, adj, node_type_name, node_type_num, node_id_to_type, edge_name);
		if(strcmp(tfidf_type.c_str(), "S-M-S") == 0 || strcmp(tfidf_type.c_str(), "SLV1") == 0 || strcmp(tfidf_type.c_str(), "SLV2") == 0 ){
			loadMetaInfo(dataset, hin_graph_);
		}


		string file_name = getFileName(src, dst, tfidf_type, k, dataset, beta);

		vector<pair<vector<double>, vector<int>>> topKMetaPaths;

		t1 = clock();
		topKMetaPaths = TopKCalculator::getTopKMetaPath_TFIDF(src, dst, k, hin_graph_);
		t2 = clock();

		output(topKMetaPaths, edge_name, file_name, output_type);
		cerr << "Take " << (0.0 + t2 - t1) / CLOCKS_PER_SEC << "s to calculate top k meta-paths" << endl;

	}
	else {
		printUsage(argv);
		return -1;
	}



	return 0;
}
